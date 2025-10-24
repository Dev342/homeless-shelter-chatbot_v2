import { NextRequest } from "next/server";
export const runtime = "edge";

import { z } from "zod";
import { qdrant, SHELTER_COLLECTION } from "@/lib/qdrant";
import { embedText } from "@/lib/embeddings";
import { getChatClient, getChatModelName } from "@/lib/model";
import { haversineKm, miles } from "@/lib/geo";
import { redactAddressIfDV } from "@/lib/redact";
import { redisGet, redisSet } from "@/lib/cache";

// -------------------- CONFIG --------------------
const Input = z.object({
  query: z.string().min(1),
  userLocation: z.object({ lat: z.number(), lon: z.number() }).optional(),
});

const SYSTEM = `
You are a compassionate but concise assistant helping people find homeless shelters.

💛 Tone:
- Be warm, calm, and reassuring.
- Use short sentences (1–2 per line).
- Always use markdown-style bullet points for clarity.

📋 Format:
- Start with one short supportive sentence.
- Then list shelters using this format:
  - **Shelter Name** — [address withheld if DV]  
    📞 phone | 🔗 website | 🏠 key services

🧠 Rules:
- Only show shelters when the user asks for them.
- If they ask about one shelter, focus on that one with more details (services, contact, hours, etc.).
- Never reveal safe-house addresses.
- Keep responses brief but kind.
`;

// -------------------- API ENTRY --------------------
export async function POST(req: NextRequest) {
  console.log("🔹 Received POST /api/chat");

  try {
    const body = await req.json();
    const { query, userLocation } = Input.parse(body);
    console.log("🟢 Parsed request:", query, userLocation);

    const cacheKey = `resp:${hash(query)}:${userLocation?.lat ?? "x"}:${userLocation?.lon ?? "x"}`;
    const cached = await redisGet(cacheKey);
    if (cached) {
      console.log("💾 Cache hit");
      return new Response(cached, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // ------------------ Embedding + Search ------------------
    console.log("🧠 Creating embedding...");
    const vec = await embedText(query);

    console.log("📡 Searching Qdrant...");
    const results = await qdrant.search(SHELTER_COLLECTION, {
      vector: vec,
      limit: 8,
      with_payload: true,
    });

    if (!results.length) console.log("⚠️ No shelters found in Qdrant.");

    const resc = results.map((r: any) => {
      const d = r.payload;
      const distKm =
        userLocation && haversineKm(userLocation.lat, userLocation.lon, d.lat, d.lon);
      return { ...d, distKm };
    });

    const formatted = resc
      .map((s: any) => {
        const addr = redactAddressIfDV(s.services, s.address);
        const dist =
          s.distKm && isFinite(s.distKm) ? ` (${miles(s.distKm).toFixed(1)} mi)` : "";
        return `- **${s.name}** — ${addr}${dist}  
  📞 ${s.phone || "N/A"} | 🔗 ${s.website || "N/A"} | 🏠 ${s.services || "N/A"}`;
      })
      .join("\n");

    console.log("🧾 Retrieved shelters:\n", formatted);

    // ------------------ Prompt Logic ------------------
    const lowerQ = query.toLowerCase();
    const wantsShelters =
      ["shelter", "help", "homeless", "housing", "bed", "safe", "place"].some((word) =>
        lowerQ.includes(word)
      );

    // Detect if user asked about a specific shelter
    let focusShelter = "";
    for (const r of resc) {
      const name = (r.name || "").toLowerCase();
      if (query.toLowerCase().includes(name.split(" ")[0])) {
        focusShelter = r.name;
        break;
      }
    }

    // Build system prompt dynamically
    let systemPrompt = SYSTEM;
    if (wantsShelters && formatted) {
      if (focusShelter) {
        // Focused view for one shelter
        const focused = resc.find((r) => r.name === focusShelter);
        if (focused) {
          systemPrompt += `
This is the shelter the user is asking about:
Name: ${focused.name}
Address: ${redactAddressIfDV(focused.services, focused.address)}
Phone: ${focused.phone || "N/A"}
Website: ${focused.website || "N/A"}
Services: ${focused.services || "N/A"}

Provide a short, kind summary of what this shelter offers.`;
        }
      } else {
        // General list view
        systemPrompt += `\nResources:\n${formatted}`;
      }
    }

    // ------------------ Call LLM ------------------
    console.log("🧠 Calling LLM...");
    const client = await getChatClient();
    const model = getChatModelName();

    if (process.env.GROQ_API_KEY && model.includes("llama")) {
      console.log(`🚀 Using Groq backend with model: ${model}`);
    } else if (process.env.OPENAI_API_KEY && model.includes("gpt")) {
      console.log(`✨ Using OpenAI backend with model: ${model}`);
    } else {
      console.log(`🤔 Using fallback model: ${model}`);
    }

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 400,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    });

    // ------------------ Stream Response ------------------
    console.log("✅ Starting streaming response...");
    let full = "";

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          for await (const chunk of completion) {
            const delta = (chunk as any).choices?.[0]?.delta?.content || "";
            if (delta) {
              full += delta;
              controller.enqueue(enc.encode(delta));
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.close();
          await redisSet(cacheKey, full, 3600);
          console.log("💾 Response cached.");
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err: any) {
    console.error("❌ Error in /api/chat:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// -------------------- Helper --------------------
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(16);
}
