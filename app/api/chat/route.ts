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
You are a compassionate chatbot designed to assist homeless individuals in the Dallas–Fort Worth (DFW) area. Your primary goal is to help users quickly find nearby shelters and essential resources through a supportive, conversational interface.
Core Principles:

Empathy and Respect: Always respond in a caring, non-judgmental, and encouraging tone. Treat every user with dignity.
Clarity and Simplicity: Provide clear, easy-to-understand instructions and information. Avoid jargon.
Accuracy: Share up-to-date and reliable information about shelters, including location, hours, eligibility, and contact details.
Accessibility: Support multiple languages (English, Spanish, and others as needed). Detect language and respond accordingly.
Safety: Never share harmful, discriminatory, or judgmental content. Avoid sensitive personal questions unless necessary for providing help.

Capabilities:

Provide a list of nearby shelters
Offer details such as address, phone number, hours of operation, and any special requirements (e.g., ID, age, family status).
Suggest transportation options (public transit, walking directions).
Share additional resources like food banks, medical clinics, and hotlines.
Maintain a warm, encouraging tone throughout the conversation.

Behavior Guidelines:

Begin by greeting the user warmly and asking how you can help.
If the user seems distressed, acknowledge their situation with empathy before providing assistance.

Provide information in short, clear steps. Offer to repeat or clarify if needed.
End conversations with encouragement and an invitation to return for more help.

Example Style:

“Thank you for sharing that. Here are three shelters near you. Would you like directions or phone numbers?”
`;

// -------------------- API ENTRY --------------------
export async function POST(req: NextRequest) {
  console.log("🔹 Received POST /api/chat");
  console.log("🔑 OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);

  try {
    const body = await req.json();
    const { query, userLocation } = Input.parse(body);
    console.log("🟢 Parsed:", query, userLocation);

    // Cache key
    const cacheKey = `resp:${hash(query)}:${userLocation?.lat ?? "x"}:${userLocation?.lon ?? "x"}`;
    const cached = await redisGet(cacheKey);
    if (cached) {
      console.log("💾 Cache hit");
      return new Response(cached, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // ------------------ SMALL TALK GUARD ------------------
    const smallTalk = /^(hi|hello|hey|thanks|thank you|good\s*(morning|evening)|how are you)/i;
    if (smallTalk.test(query)) {
      const quickReply =
        "Hi there — I can help you find nearby shelters or safe housing options. " +
        "Try something like:\n" +
        "- women’s shelter near me\n" +
        "- family shelter 10001\n" +
        "- tell me about Hope House";
      return new Response(quickReply, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // ------------------ Embedding ------------------
    console.log("🧠 Creating embedding...");
    const vec = await embedText(query);

    // ------------------ Qdrant Search ------------------
    console.log("📡 Searching Qdrant...");
    const results = await qdrant.search(SHELTER_COLLECTION, {
      vector: vec,
      limit: 6,
      with_payload: ["name", "address", "phone", "website", "services", "lat", "lon"],
      score_threshold: 0.2,
    });

    if (!results.length) console.log("⚠️ No shelters found.");

    const resc = results.map((r: any) => {
      const d = r.payload;
      const distKm =
        userLocation && haversineKm(userLocation.lat, userLocation.lon, d.lat, d.lon);
      return { ...d, distKm };
    });

    // ------------------ Format Results ------------------
    const formatted = resc
      .map((s: any) => {
        const addr = redactAddressIfDV(s.services, s.address);
        const dist =
          s.distKm && isFinite(s.distKm) ? ` • ${miles(s.distKm).toFixed(1)} mi` : "";
        const phone = s.phone ? ` • ${s.phone}` : "";
        const site = s.website ? ` • ${s.website}` : "";
        const tag = s.services ? ` • ${s.services.split(/[.;]/)[0]}` : "";
        return `- **${s.name}** — ${addr}${dist}${phone}${site}${tag}`;
      })
      .join("\n");

    console.log("🧾 Retrieved shelters:\n", formatted);

    // ------------------ Determine Intent ------------------
    const lowerQ = query.toLowerCase();
    const wantsShelters =
      ["shelter", "homeless", "housing", "help", "safe", "place", "find"].some((w) =>
        lowerQ.includes(w)
      );

    let focusShelter = "";
    for (const r of resc) {
      const name = (r.name || "").toLowerCase();
      if (lowerQ.includes(name.split(" ")[0])) {
        focusShelter = r.name;
        break;
      }
    }

    // ------------------ Build Prompt ------------------
    let systemPrompt = SYSTEM;
    if (wantsShelters && formatted) {
      if (focusShelter) {
        const focused = resc.find((r) => r.name === focusShelter);
        if (focused) {
          systemPrompt += `
This is the shelter the user asked about:
Name: ${focused.name}
Address: ${redactAddressIfDV(focused.services, focused.address)}
Phone: ${focused.phone || "N/A"}
Website: ${focused.website || "N/A"}
Services: ${focused.services || "N/A"}

Give a short, kind summary of what this shelter provides.`;
        }
      } else {
        systemPrompt += `\nNearby shelters:\n${formatted}`;
      }
    }

    // ------------------ Call LLM ------------------
    console.log("🧠 Calling LLM...");
    const client = await getChatClient();
    const model = getChatModelName();

    if (process.env.GROQ_API_KEY && model.includes("llama"))
      console.log(`🚀 Using Groq backend: ${model}`);
    else if (process.env.OPENAI_API_KEY && model.includes("gpt"))
      console.log(`✨ Using OpenAI backend: ${model}`);
    else console.log(`🤔 Using fallback model: ${model}`);

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
          if (full) await redisSet(cacheKey, full, 3600);
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
