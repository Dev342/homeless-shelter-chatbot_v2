// lib/cache.ts
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function redisGet(key: string) {
  if (!redis) return null;
  try { return await redis.get<string>(key); } catch { return null; }
}

export async function redisSet(key: string, value: string, ttlSec = 3600) {
  if (!redis) return;
  try { await redis.set(key, value, { ex: ttlSec }); } catch {}
}
