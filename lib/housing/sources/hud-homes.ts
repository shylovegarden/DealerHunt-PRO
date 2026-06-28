// lib/housing/sources/hud-homes.ts
//
// HUD Homes (hudhomestore.gov) — government-owned (FHA-foreclosed) homes, prime flip leads, and the
// RICHEST free housing source: every listing carries sqft / beds / baths / year-built / precise lat-lng /
// distress status ("Price Reduced") — enough to fire HomeIQ's 70%-rule deal analysis. The site SSRs the
// whole result set into a hidden <input id="available_prop" value="...JSON..."> (captured by Antigravity
// in docs/findings/hud-homes-api.md), so a plain GET + parse pulls it all — no JS, no API keys, no proxy.
// Vertical isolation: HUD lists ONLY homes → these are Property rows; they never touch the cars `deals`.

import type { Property, PropertyType } from "../types";

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const num = (v: unknown): number | undefined => {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return isFinite(n) && n !== 0 ? n : undefined;
};

function classify(raw: string): PropertyType {
  const s = (raw || "").toLowerCase();
  if (/multi|duplex|triplex|fourplex/.test(s)) return "multi_family";
  if (/condo/.test(s)) return "condo";
  if (/town/.test(s)) return "townhouse";
  if (/manufactured|mobile/.test(s)) return "mobile";
  if (/land|lot/.test(s)) return "land";
  if (/single|home|residence|house/.test(s)) return "single_family";
  return "single_family"; // HUD inventory is overwhelmingly homes
}

function isoDate(mdy?: string): string | undefined {
  if (!mdy) return undefined;
  const d = new Date(mdy);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

interface HudRaw {
  propertyCaseNumber?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  listPrice?: string;
  bedrooms?: string;
  bathroomsdecimal?: number;
  bathrooms?: string;
  squareFootage?: string;
  yearBuilt?: string;
  propertyStatus?: string;
  propertyType?: string;
  latitude?: string;
  longitude?: string;
  propertyThumb?: string;
  bidOpenDate?: string;
  periodDeadlineDate?: string;
}

/** Map one HUD raw listing to a HomeIQ Property. Null for unusable rows. */
export function mapHudListing(p: HudRaw): Property | null {
  const caseNo = p.propertyCaseNumber;
  if (!caseNo) return null;
  const price = num(p.listPrice);
  if (!price) return null;

  const lat = p.latitude ? Number(p.latitude) : undefined;
  const lng = p.longitude ? Number(p.longitude) : undefined;
  const status = (p.propertyStatus || "").trim();

  return {
    source: "hud",
    source_listing_id: `hud-${caseNo}`,
    source_url: `https://www.hudhomestore.gov/Listing/PropertyDetails?caseNumber=${encodeURIComponent(caseNo)}`,
    title: [p.propertyAddress, p.propertyCity, p.propertyState]
      .filter(Boolean)
      .join(", "),
    property_type: classify(p.propertyType || ""),
    // Fold the HUD status into the description so lead-scoring sees "Price Reduced" as a distress signal.
    description: status ? `HUD home — ${status}` : "HUD home",
    address: p.propertyAddress?.trim() || undefined,
    city: p.propertyCity?.trim() || undefined,
    state: p.propertyState?.trim() || undefined,
    zip: p.propertyZip?.trim() || undefined,
    lat: lat != null && isFinite(lat) ? lat : undefined,
    lng: lng != null && isFinite(lng) ? lng : undefined,
    price,
    beds: num(p.bedrooms),
    baths:
      typeof p.bathroomsdecimal === "number"
        ? p.bathroomsdecimal
        : num(p.bathrooms),
    sqft: num(p.squareFootage),
    year_built: num(p.yearBuilt),
    images: p.propertyThumb ? [p.propertyThumb] : [],
    seller: "HUD (U.S. Dept. of Housing)",
    seller_type: "gov",
    auction_end: isoDate(p.bidOpenDate) || isoDate(p.periodDeadlineDate),
    signals: { channel: "hud", status, marketplace: "hudhomestore" },
    scraped_at: new Date().toISOString(),
  };
}

/** Parse a HUD search-result page: the listings JSON lives in a hidden input's value attribute. */
export function parseHudListings(html: string): Property[] {
  const m = html.match(/id="available_prop"\s+value="([^"]*)"/);
  if (!m) return [];
  const json = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'");
  let raw: HudRaw[];
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  const out: Property[] = [];
  for (const r of raw) {
    const p = mapHudListing(r);
    if (p) out.push(p);
  }
  return out;
}

/** Harvest HUD Homes across states. Free GET per state; deduped by case number. */
export async function scrapeHudHomes(
  states: string[] = US_STATES,
  delayMs = 400,
): Promise<Property[]> {
  console.log("[HomeIQ:HUD] harvesting HUD homes...");
  const byId = new Map<string, Property>();
  for (const st of states) {
    try {
      const res = await fetch(
        `https://www.hudhomestore.gov/searchresult?citystate=${st}`,
        { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } },
      );
      if (!res.ok) continue;
      for (const p of parseHudListings(await res.text()))
        byId.set(p.source_listing_id!, p);
    } catch (e) {
      console.warn(`[HomeIQ:HUD] ${st} failed:`, (e as Error).message);
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  const properties = Array.from(byId.values());
  console.log(`[HomeIQ:HUD] found ${properties.length} homes`);
  return properties;
}
