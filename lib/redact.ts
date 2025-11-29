export function redactAddressIfDV(services: string = "", address: string = "") {
  const lowered = services.toLowerCase();

  const dvKeywords = [
    "domestic violence",
    "women's shelter",
    "women shelter",
    "dv",
    "abuse",
    "sexual assault",
    "family violence",
    "trafficking",
    "survivor",
  ];

  if (dvKeywords.some(k => lowered.includes(k))) {
    return null; // hides address
  }

  return address;
}
