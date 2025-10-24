// scripts/ingest.mjs
import "dotenv/config";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import fetch from "node-fetch";
import { randomUUID } from "crypto";

// === Initialize Clients ===
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COLLECTION = "shelters";
const VECTOR_SIZE = 1536;

// === Ensure Collection ===
async function ensureCollection() {
  try {
    await qdrant.getCollection(COLLECTION);
    console.log(`ℹ️ Collection "${COLLECTION}" already exists.`);
  } catch {
    console.log(`🆕 Creating collection "${COLLECTION}"...`);
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
  }
}

// === Fetch by ZIP (RapidAPI) ===
async function fetchByZip(zip) {
  const url = `https://homeless-shelter.p.rapidapi.com/zipcode?zipcode=${zip}`;
  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": "homeless-shelter.p.rapidapi.com",
      "x-rapidapi-key": process.env.RAPIDAPI_KEY,
    },
  });
  if (!res.ok) throw new Error(`RapidAPI ${res.status}`);
  return res.json();
}

// === Fetch Dallas Shelters from Multiple ZIPs ===
async function fetchDallasShelters() {
  const zips = ["75201", "75204", "75215", "75219", "75205"];
  let all = [];
  for (const zip of zips) {
    try {
      const shelters = await fetchByZip(zip);
      console.log(`📦 ZIP ${zip} returned ${shelters.length} shelters`);
      all.push(...shelters);
    } catch (err) {
      console.warn(`⚠️ ZIP ${zip} failed: ${err.message}`);
    }
  }

  if (all.length === 0) {
    console.warn("⚠️ All ZIPs failed — using fallback Dallas data.");
    return [
      {
        name: "Dallas Life Shelter",
        address: "1100 Cadiz St",
        city: "Dallas",
        state: "TX",
        zip_code: "75215",
        location: "32.7725,-96.7914",
        phone_number: "(214) 421-1380",
        official_website: "https://dallaslife.org/",
        description:
          "Provides emergency shelter, meals, and rehabilitation programs for homeless men, women, and children in Dallas.",
      },
      {
        name: "The Stewpot Dallas",
        address: "1835 Young St",
        city: "Dallas",
        state: "TX",
        zip_code: "75201",
        location: "32.7816,-96.7970",
        phone_number: "(214) 746-2785",
        official_website: "https://thestewpot.org/",
        description:
          "Community ministry providing meals, job assistance, and case management services to the homeless population in downtown Dallas.",
      },
    ];
  }

  return all;
}

// === Normalize ===
function normalize(x) {
  const [lat, lon] = x.location ? x.location.split(",").map(Number) : [null, null];
  return {
    id: randomUUID(),
    name: x.name ?? "Unknown",
    address: [x.address, x.city, x.state, x.zip_code].filter(Boolean).join(", "),
    phone: x.phone_number ?? null,
    website: x.official_website ?? null,
    services: x.description ?? null,
    city: x.city ?? null,
    state: x.state ?? null,
    zipcode: x.zip_code ?? null,
    lat,
    lon,
    isDV: /domestic\s*violence|safe\s*house|abuse/i.test(`${x.name} ${x.description || ""}`),
    source: "rapidapi",
    fetchedAt: new Date().toISOString(),
  };
}

// === Embed ===
async function embed(text) {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return r.data[0].embedding;
}

// === Main ===
async function main() {
  await ensureCollection();
  console.log("📡 Fetching Dallas shelters by multiple ZIP codes...");
  const raw = await fetchDallasShelters();
  const docs = raw.map(normalize);

  console.log(`📦 Total fetched ${docs.length} shelters.`);
  if (docs.length === 0) return console.log("⚠️ No shelters found — nothing to ingest.");

  for (const d of docs) {
    const text = [d.name, d.services || "", d.address || "", d.city || "", d.state || ""].join("\n");
    const vector = await embed(text);

    await qdrant.upsert(COLLECTION, {
      wait: true,
      points: [{ id: d.id, vector, payload: d }],
    });

    console.log(`✅ Added: ${d.name}`);
  }

  console.log("🎉 Ingestion complete!");
}

// === Run ===
main().catch(console.error);
