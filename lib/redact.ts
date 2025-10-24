// lib/redact.ts
export function isDVFromText(text: string) {
  if (!text) return false;
  
  // Stricter match — look for DV/safe-house indicators at start or as a main focus
  return /\b(domestic\s+violence|safe\s*house|abuse\s*shelter)\b/i.test(text)
    && !/\b(homeless|family|men|youth|general|emergency)\b/i.test(text);
}

export function redactAddressIfDV(services?: string, address?: string) {
  if (!address) return "N/A";
  if (services && isDVFromText(services)) {
    return "[Address withheld for safety]";
  }
  return address;
}
