// lib/housing/extract-property.ts
//
// The chameleon's hands, for houses. Mirrors lib/scrapers/generic-extractor.ts (cars) but reads the
// HOUSING shapes: schema.org RealEstateListing / SingleFamilyResidence / Residence / Place / Offer, and
// vehicle-style __NEXT_DATA__ walks (Zillow, Redfin, Realtor.com all ship listings in a __NEXT_DATA__
// island). So a housing portal that uses either pattern needs ZERO bespoke parser — genericExtract
// Properties(html) returns Property[]. Schema-agnostic by field-name families, sanity-bounded, deduped.
// Reuses safeJsonParse so it survives the malformed JSON real sites emit.

import type { Property, PropertyType } from "./types";
import { safeJsonParse } from "../scrapers/generic-extractor";

const toNum = (v: unknown): number | null => {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,\s]/g, ""));
    if (isFinite(n) && /\d/.test(v)) return n;
  }
  return null;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const F = {
  price: [
    "price",
    "listPrice",
    "salePrice",
    "askingPrice",
    "currentBid",
    "amount",
  ],
  beds: ["beds", "bedrooms", "numberOfBedrooms", "numberOfRooms", "bed"],
  baths: [
    "baths",
    "bathrooms",
    "numberOfBathroomsTotal",
    "numberOfBathrooms",
    "bath",
  ],
  sqft: [
    "sqft",
    "livingArea",
    "floorSize",
    "squareFeet",
    "livingAreaValue",
    "area",
  ],
  lot: ["lotSize", "lotSizeAcres", "lotAreaValue", "lotSizeValue"],
  yearBuilt: ["yearBuilt", "yearOfConstruction", "constructionYear"],
  zip: ["postalCode", "zipcode", "zip"],
  city: ["addressLocality", "city"],
  state: ["addressRegion", "state", "stateOrProvince"],
  url: ["url", "detailUrl", "permalink", "link"],
  image: ["image", "imageUrl", "photo", "primaryPhoto"],
  type: ["propertyType", "homeType", "@type", "type"],
};

function pick(obj: Record<string, any>, keys: string[]): unknown {
  for (const k of Object.keys(obj)) {
    if (keys.some((w) => k.toLowerCase() === w.toLowerCase())) {
      const v = obj[k];
      if (v != null && v !== "") return v;
    }
  }
  return undefined;
}

function deref(v: unknown): unknown {
  if (v && typeof v === "object") {
    const o = v as any;
    return o.value ?? o.name ?? v;
  }
  return v;
}

function priceOf(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return priceOf(v[0]);
  if (typeof v === "object") {
    const o = v as any;
    return priceOf(
      o.price ?? o.lowPrice ?? o.amount ?? o.priceSpecification?.price,
    );
  }
  const n = toNum(v);
  // Houses run wide; land can be cheap, estates pricey. Reject sub-$1k (fees) and >$50M (commercial noise).
  return n != null && n >= 1000 && n <= 50_000_000 ? n : undefined;
}

function imageOf(v: unknown): string | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return imageOf(v[0]);
  if (typeof v === "object")
    return str((v as any).url) || str((v as any).contentUrl) || undefined;
  return str(v) || undefined;
}

function classify(raw: string): PropertyType | undefined {
  const s = raw.toLowerCase();
  if (/multi|duplex|triplex|fourplex/.test(s)) return "multi_family";
  if (/\bland\b|lot|acre|vacant/.test(s)) return "land";
  if (/condo/.test(s)) return "condo";
  if (/townhouse|townhome/.test(s)) return "townhouse";
  if (/mobile|manufactured/.test(s)) return "mobile";
  if (/single|house|residence|home/.test(s)) return "single_family";
  return undefined;
}

// Pull a street address out of a schema.org PostalAddress or a flat object.
function addressOf(obj: Record<string, any>): {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
} {
  const a = obj.address && typeof obj.address === "object" ? obj.address : obj;
  const street =
    str(a.streetAddress) || str(obj.streetAddress) || str(obj.addressLine1);
  return {
    address: street || undefined,
    city:
      str(deref(pick(a, F.city))) || str(deref(pick(obj, F.city))) || undefined,
    state:
      str(deref(pick(a, F.state))) ||
      str(deref(pick(obj, F.state))) ||
      undefined,
    zip:
      str(deref(pick(a, F.zip))) || str(deref(pick(obj, F.zip))) || undefined,
  };
}

/** Read a Property out of one object (any housing schema). Null when it isn't plausibly a listing. */
export function readProperty(obj: Record<string, any>): Property | null {
  if (!obj || typeof obj !== "object") return null;
  const loc = addressOf(obj);
  const price = priceOf(pick(obj, F.price) ?? obj.offers);
  const beds = toNum(deref(pick(obj, F.beds))) ?? undefined;
  const sqft = toNum(deref(pick(obj, F.sqft))) ?? undefined;

  // A real listing needs a place (street address, or city+state) AND a signal it's a home (price/beds/sqft).
  const hasPlace = !!loc.address || (!!loc.city && !!loc.state);
  const hasHomeSignal = price != null || beds != null || sqft != null;
  if (!hasPlace || !hasHomeSignal) return null;

  const typeRaw =
    str(deref(pick(obj, F.type))) +
    " " +
    str(obj.name) +
    " " +
    str(obj.description);

  return {
    source: "generic",
    source_url: str(pick(obj, F.url)) || undefined,
    title:
      str(obj.name) ||
      [loc.address, loc.city, loc.state].filter(Boolean).join(", ") ||
      "Property",
    property_type: classify(typeRaw),
    address: loc.address,
    city: loc.city,
    state: loc.state,
    zip: loc.zip,
    price,
    beds,
    baths: toNum(deref(pick(obj, F.baths))) ?? undefined,
    sqft,
    lot_size_acres: toNum(deref(pick(obj, F.lot))) ?? undefined,
    year_built: toNum(deref(pick(obj, F.yearBuilt))) ?? undefined,
    images: imageOf(pick(obj, F.image)) ? [imageOf(pick(obj, F.image))!] : [],
    scraped_at: new Date().toISOString(),
  };
}

const REAL_ESTATE_TYPE =
  /RealEstateListing|SingleFamilyResidence|Residence|Apartment|House|Place|Accommodation/i;

function walk(root: any, out: Property[], depth = 0): void {
  if (!root || typeof root !== "object" || depth > 8 || out.length > 500)
    return;
  if (Array.isArray(root)) {
    for (const it of root) walk(it, out, depth + 1);
    return;
  }
  const p = readProperty(root);
  if (p) out.push(p);
  for (const k of Object.keys(root)) {
    const c = root[k];
    if (c && typeof c === "object") walk(c, out, depth + 1);
  }
}

function dedupe(list: Property[]): Property[] {
  const seen = new Set<string>();
  const out: Property[] = [];
  for (const p of list) {
    const key = (p.address || p.title || "") + "|" + (p.zip || p.city || "");
    if (seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(p);
  }
  return out;
}

export function extractPropertiesFromJsonLd(html: string): Property[] {
  const out: Property[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const json = safeJsonParse(m[1].trim());
    if (!json) continue;
    const nodes = Array.isArray(json) ? json : json["@graph"] || [json];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node.itemListElement)) {
        for (const el of node.itemListElement) {
          const obj = el?.item || el;
          const p = readProperty(obj);
          if (p) out.push(p);
        }
      }
      const t = String(node["@type"] || "");
      if (REAL_ESTATE_TYPE.test(t) || node.address) {
        const p = readProperty(node);
        if (p) out.push(p);
      }
    }
  }
  return dedupe(out);
}

export function extractPropertiesFromNextData(html: string): Property[] {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const data = safeJsonParse(m[1]);
  if (!data) return [];
  const out: Property[] = [];
  walk(data?.props ?? data, out);
  return dedupe(out);
}

/** Schema-agnostic property extraction for ANY housing page (JSON-LD or __NEXT_DATA__). */
export function genericExtractProperties(
  html: string,
  source = "generic",
): Property[] {
  const found = dedupe([
    ...extractPropertiesFromJsonLd(html),
    ...extractPropertiesFromNextData(html),
  ]);
  return found.map((p) => ({ ...p, source }));
}
