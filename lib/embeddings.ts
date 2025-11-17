// lib/embeddings.ts
import OpenAI from "openai";
import { redisGet, redisSet } from "./cache";

const model = process.env.EMBEDDINGS_MODEL || "text-embedding-3-small";

let openai: OpenAI | null = null;

function getClient() {
  if (openai) return openai;
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai;
  }
  throw new Error("Missing OPENAI_API_KEY");
}

export async function embedText(text: string): Promise<number[]> {
  const key = `embed:${model}:${hash(text)}`;
  const cached = await redisGet(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      console.warn("⚠️ Invalid cached embedding, ignoring:", cached);
    }
  }

  const client = getClient();
  console.log("🚀 Creating embedding with model:", model);
  const res = await client.embeddings.create({ model, input: text });
  const vec = res.data[0].embedding;

  await redisSet(key, JSON.stringify(vec), 86400);
  return vec;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(16);
}
