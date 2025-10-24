// lib/qdrant.ts
import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

export const SHELTER_COLLECTION = "shelters";
export const VECTOR_SIZE = 1536;

export type ShelterDoc = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  services?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  lat?: number;
  lon?: number;
  isDV?: boolean;
  source: "topapis";
  fetchedAt: string;
};

export function shelterText(d: ShelterDoc) {
  return [
    `Name: ${d.name}`,
    d.address && `Address: ${d.address}`,
    d.phone && `Phone: ${d.phone}`,
    d.website && `Website: ${d.website}`,
    d.services && `Services: ${d.services}`,
    [d.city, d.state, d.zipcode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}
