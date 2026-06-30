// lib/housing/address-normalize.ts
//
// Canonical address key for cross-source LIST-STACKING. The same physical property can appear on several
// distress lists (e.g. Philly tax-delinquent AND code-violation), each as its own row from a different
// source. Normalizing the street address + locality to one key lets us count how many independent distress
// lists a property sits on — the "stack count" that BatchLeads/REsimpli use to surface the most motivated
// sellers. Pure + tested.

// Street-type + directional abbreviations → one canonical token so "Street"/"St", "Avenue"/"Ave" collapse.
const TOKEN: Record<string, string> = {
  street: "st",
  st: "st",
  avenue: "ave",
  ave: "ave",
  av: "ave",
  road: "rd",
  rd: "rd",
  drive: "dr",
  dr: "dr",
  lane: "ln",
  ln: "ln",
  boulevard: "blvd",
  blvd: "blvd",
  court: "ct",
  ct: "ct",
  place: "pl",
  pl: "pl",
  terrace: "ter",
  ter: "ter",
  circle: "cir",
  cir: "cir",
  highway: "hwy",
  hwy: "hwy",
  parkway: "pkwy",
  pkwy: "pkwy",
  trail: "trl",
  square: "sq",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
};

/**
 * A canonical "{street}|{locality}" key, or null if there isn't enough to dedupe on. Locality prefers the
 * 5-digit ZIP (most precise), else "city state". Unit/apt/suite suffixes are dropped so the building keys
 * together.
 */
export function normalizeAddress(
  address?: string | null,
  city?: string | null,
  state?: string | null,
  zip?: string | null,
): string | null {
  if (!address) return null;
  const street = String(address)
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(unit|apt|ste|suite|fl|floor)\b.*$/i, "") // drop unit designators
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => TOKEN[t] ?? t)
    .join(" ")
    .trim();
  const z = zip ? String(zip).slice(0, 5).trim() : "";
  const locality =
    z || [city, state].filter(Boolean).join(" ").toLowerCase().trim();
  if (!street || !locality) return null;
  return `${street}|${locality}`;
}
