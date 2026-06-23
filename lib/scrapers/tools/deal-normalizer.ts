// lib/scrapers/tools/deal-normalizer.ts
// Normalize scraped deal fields before validation and persistence to improve accuracy and deduplication.

import type { Deal } from "@/types";

// Known makes incl. multi-word, luxury, and newer EV brands. Common aliases map to canonical.
const MAKE_ALIASES: Record<string, string> = {
  chevy: "Chevrolet",
  vw: "Volkswagen",
  mercedes: "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  benz: "Mercedes-Benz",
  "range rover": "Land Rover",
  landrover: "Land Rover",
  "rolls royce": "Rolls-Royce",
  aston: "Aston Martin",
  alfa: "Alfa Romeo",
  "mini cooper": "Mini",
};
const MAKES = [
  "Acura",
  "Alfa Romeo",
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ferrari",
  "Fiat",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hummer",
  "Hyundai",
  "Infiniti",
  "Isuzu",
  "Jaguar",
  "Jeep",
  "Kia",
  "Lamborghini",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Lucid",
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes-Benz",
  "Mercury",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Pontiac",
  "Polestar",
  "Porsche",
  "Ram",
  "Rivian",
  "Rolls-Royce",
  "Saturn",
  "Scion",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];
// Match longer/multi-word makes first so "Land Rover" wins over a stray "Land".
const MAKES_BY_LENGTH = [...MAKES].sort((a, b) => b.length - a.length);

// Recognized real automotive makes (canonical + common aliases), lowercased, for validating a
// scraped/decoded make elsewhere. A "make" not in here (e.g. "Biz" from "2024 Biz On Wheels") is a
// junk/mis-parsed listing, not a valuation-grade vehicle — callers should refuse to score it.
const KNOWN_MAKE_SET = new Set<string>([
  ...MAKES.map((m) => m.toLowerCase()),
  ...Object.keys(MAKE_ALIASES),
]);

export function isKnownMake(make?: string | null): boolean {
  if (!make) return false;
  return KNOWN_MAKE_SET.has(make.trim().toLowerCase());
}

export function normalizeVin(vin?: string): string | undefined {
  if (!vin) return undefined;
  const cleaned = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
  return cleaned.length === 17 ? cleaned : undefined;
}

export function normalizeTitle(title?: string): string | undefined {
  if (!title) return undefined;
  return title
    .replace(/\s+/g, " ")
    .replace(/\b(\d{4})\s+/g, "$1 ")
    .trim();
}

export function extractYear(title?: string): number | undefined {
  if (!title) return undefined;
  const match = title.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : undefined;
}

export function extractMake(title?: string): string | undefined {
  if (!title) return undefined;
  const lower = ` ${title.toLowerCase()} `;
  // Aliases first (chevy → Chevrolet, etc.)
  for (const [alias, canonical] of Object.entries(MAKE_ALIASES)) {
    if (lower.includes(` ${alias} `) || lower.includes(`${alias} `))
      return canonical;
  }
  for (const make of MAKES_BY_LENGTH) {
    if (lower.includes(make.toLowerCase())) return make;
  }
  return undefined;
}

export function extractMileage(title?: string): number | undefined {
  if (!title) return undefined;
  // "78k miles", "78,000 mi", "120000 miles"
  const k = title.match(/\b(\d{1,3})\s*k\b/i);
  if (k) {
    const v = parseInt(k[1], 10) * 1000;
    if (v >= 1000 && v <= 400000) return v;
  }
  const m = title.match(
    /\b(\d{2,3}(?:,\d{3})|\d{4,6})\s*(?:mi|miles|mileage|odo)\b/i,
  );
  if (m) {
    const v = parseInt(m[1].replace(/,/g, ""), 10);
    if (v >= 1000 && v <= 400000) return v;
  }
  return undefined;
}

export function extractModel(
  title?: string,
  make?: string,
): string | undefined {
  if (!title || !make) return undefined;
  const pattern = new RegExp(`${make}\\s+([A-Za-z0-9-]+)`, "i");
  const match = title.match(pattern);
  if (!match) return undefined;
  return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
}

export function normalizeLocation(location?: string): string | undefined {
  if (!location) return undefined;
  return location.replace(/\s+/g, " ").replace(/,\s+/g, ", ").trim();
}

export function normalizeDeal(deal: Partial<Deal>): Partial<Deal> {
  const normalized = { ...deal };

  normalized.vin = normalizeVin(normalized.vin);
  normalized.title = normalizeTitle(normalized.title);
  normalized.year = normalized.year || extractYear(normalized.title);
  // Title is authoritative for make: scrapers do positional guessing that mangles multi-word
  // makes ("Land Rover", "Mercedes-Benz") — re-derive from the title when we recognize a make.
  const titleMake = extractMake(normalized.title);
  if (titleMake) {
    normalized.make = titleMake;
    normalized.model =
      extractModel(normalized.title, titleMake) || normalized.model;
  } else {
    normalized.make = normalized.make || extractMake(normalized.title);
    normalized.model =
      normalized.model || extractModel(normalized.title, normalized.make);
  }
  normalized.mileage = normalized.mileage || extractMileage(normalized.title);
  normalized.location_city = normalizeLocation(normalized.location_city);
  normalized.location_state = normalizeLocation(normalized.location_state);

  if (normalized.ask_price !== undefined) {
    normalized.ask_price = Math.max(0, Math.round(normalized.ask_price));
  }
  if (normalized.mileage !== undefined) {
    normalized.mileage = Math.max(0, Math.round(normalized.mileage));
  }

  return normalized;
}

export function normalizeDeals(deals: Partial<Deal>[]): Partial<Deal>[] {
  return deals.map(normalizeDeal);
}
