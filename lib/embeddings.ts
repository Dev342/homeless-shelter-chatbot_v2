// lib/embeddings.ts
import OpenAI from "openai";
import { redisGet, redisSet } from "./cache";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const model = process.env.EMBEDDINGS_MODEL || "text-embedding-3-small";

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

  if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY missing inside embedText()");
  throw new Error("Missing OpenAI API key");
}

console.log("🚀 Creating embedding with model:", model);


  const r = await openai.embeddings.create({ model, input: text });
  const vec = r.data[0].embedding;
  await redisSet(key, JSON.stringify(vec), 86400);
  return vec;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(16);
}
