import OpenAI from "openai";

export async function getChatClient() {
  // Prefer Groq if key exists
  if (process.env.GROQ_API_KEY) {
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY!,
      baseURL: "https://api.groq.com/openai/v1",
    });

    // Test that Groq actually works
    try {
      await groq.models.list();
      console.log("✅ Using Groq API");
      return groq;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : JSON.stringify(err);
      console.warn("⚠️ Groq not available, falling back to OpenAI:", message);
    }
  }

  // Fallback: use OpenAI
  if (process.env.OPENAI_API_KEY) {
    console.log("✅ Using OpenAI API");
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }

  throw new Error("❌ No valid API key found for either Groq or OpenAI");
}

export function getChatModelName() {
  if (process.env.GROQ_API_KEY)
    return process.env.GROQ_MODEL || "llama-3.1-70b-versatile";
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}
