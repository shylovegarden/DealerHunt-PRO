// lib/housing/sources/redfin-gis.ts
//
// THE open MLS door — verified live (docs/findings/redfin-gis-api.md). Redfin's internal map endpoint
// `/stingray/api/gis-csv` returns up to 350 listings as a clean CSV, and it accepts a raw lat/lng polygon
// (`poly=`) — so we need NO region-id lookup, NO autocomplete, NO anti-bot tier. A plain static GET returns
// the SAME on-market MLS data Zillow/Realtor resell: MLS#, listing brokerage, address, price, beds/baths,
// sqft, year built, lat/lng, open-house times. This is MLS-sourced listing data, free, nationwide.
//
// Coverage by tiling: each query is a lat/lng bounding box capped at 350 rows. We seed major metros
// (center + radius → bbox) and quad-subdivide any box that maxes out, so dense metros are fully covered.
// Add areas via REDFIN_AREAS ("name|lat|lng|radiusMiles", comma-separated); the built-in seed runs by
// default so the source produces data with zero config.
//
// Sold comps (PAST SALE rows) are pulled by a sibling fetch for the valuation layer — NOT wired into the
// for-sale harvest (a sold home isn't a deal to score). harvestRedfinGis() returns active/coming-soon only.

import type { Property } from "../types";
import { stableId } from "../../db/stable-id";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MAX_ROWS = 350; // Redfin's hard cap per gis-csv response
const CAP_HIT = 300; // ≥ this many rows ⇒ the box is likely truncated; subdivide it

export interface RedfinArea {
  name: string;
  lat: number;
  lng: number;
  /** Half-extent of the search box, in miles. */
  radiusMi: number;
}

// Built-in seed: the largest market in (essentially) every state + the top national metros — NATIONWIDE
// coverage out of the box, not a handful of cities. Plain centroids + radius (no Redfin ids) — config, not
// data. Tunable/extendable via REDFIN_AREAS. Radii kept modest so each box's quad-subdivide stays bounded;
// the gis-csv door isn't anti-bot-walled, but the fleet's IP spread + the connector's per-box pacing keep
// even a full national sweep polite. "Leave NONE undiscovered" — the whole country, every harvest.
const SEED_AREAS: RedfinArea[] = [
  // — Northeast —
  { name: "New York NY", lat: 40.7128, lng: -74.006, radiusMi: 18 },
  { name: "Philadelphia PA", lat: 39.9526, lng: -75.1652, radiusMi: 14 },
  { name: "Pittsburgh PA", lat: 40.4406, lng: -79.9959, radiusMi: 14 },
  { name: "Boston MA", lat: 42.3601, lng: -71.0589, radiusMi: 14 },
  { name: "Newark NJ", lat: 40.7357, lng: -74.1724, radiusMi: 12 },
  { name: "Hartford CT", lat: 41.7658, lng: -72.6734, radiusMi: 14 },
  { name: "Providence RI", lat: 41.824, lng: -71.4128, radiusMi: 12 },
  { name: "Manchester NH", lat: 42.9956, lng: -71.4548, radiusMi: 14 },
  { name: "Portland ME", lat: 43.6591, lng: -70.2568, radiusMi: 14 },
  { name: "Burlington VT", lat: 44.4759, lng: -73.2121, radiusMi: 14 },
  // — Mid-Atlantic / Southeast —
  { name: "Baltimore MD", lat: 39.2904, lng: -76.6122, radiusMi: 12 },
  { name: "Washington DC", lat: 38.9072, lng: -77.0369, radiusMi: 14 },
  { name: "Richmond VA", lat: 37.5407, lng: -77.436, radiusMi: 16 },
  { name: "Wilmington DE", lat: 39.7391, lng: -75.5398, radiusMi: 12 },
  { name: "Charlotte NC", lat: 35.2271, lng: -80.8431, radiusMi: 18 },
  { name: "Raleigh NC", lat: 35.7796, lng: -78.6382, radiusMi: 16 },
  { name: "Columbia SC", lat: 34.0007, lng: -81.0348, radiusMi: 16 },
  { name: "Charleston SC", lat: 32.7765, lng: -79.9311, radiusMi: 16 },
  { name: "Atlanta GA", lat: 33.749, lng: -84.388, radiusMi: 18 },
  { name: "Jacksonville FL", lat: 30.3322, lng: -81.6557, radiusMi: 18 },
  { name: "Orlando FL", lat: 28.5383, lng: -81.3792, radiusMi: 18 },
  { name: "Tampa FL", lat: 27.9506, lng: -82.4572, radiusMi: 16 },
  { name: "Miami FL", lat: 25.7617, lng: -80.1918, radiusMi: 16 },
  { name: "Birmingham AL", lat: 33.5186, lng: -86.8104, radiusMi: 16 },
  { name: "Jackson MS", lat: 32.2988, lng: -90.1848, radiusMi: 16 },
  { name: "Nashville TN", lat: 36.1627, lng: -86.7816, radiusMi: 18 },
  { name: "Memphis TN", lat: 35.1495, lng: -90.049, radiusMi: 16 },
  { name: "Louisville KY", lat: 38.2527, lng: -85.7585, radiusMi: 16 },
  { name: "New Orleans LA", lat: 29.9511, lng: -90.0715, radiusMi: 14 },
  { name: "Charleston WV", lat: 38.3498, lng: -81.6326, radiusMi: 16 },
  // — Midwest —
  { name: "Chicago IL", lat: 41.8781, lng: -87.6298, radiusMi: 18 },
  { name: "Detroit MI", lat: 42.331, lng: -83.046, radiusMi: 14 },
  { name: "Cleveland OH", lat: 41.4993, lng: -81.6944, radiusMi: 12 },
  { name: "Columbus OH", lat: 39.9612, lng: -82.9988, radiusMi: 16 },
  { name: "Indianapolis IN", lat: 39.7684, lng: -86.1581, radiusMi: 18 },
  { name: "Milwaukee WI", lat: 43.0389, lng: -87.9065, radiusMi: 14 },
  { name: "Minneapolis MN", lat: 44.9778, lng: -93.265, radiusMi: 16 },
  { name: "St. Louis MO", lat: 38.627, lng: -90.1994, radiusMi: 14 },
  { name: "Kansas City MO", lat: 39.0997, lng: -94.5786, radiusMi: 16 },
  { name: "Des Moines IA", lat: 41.5868, lng: -93.625, radiusMi: 16 },
  { name: "Omaha NE", lat: 41.2565, lng: -95.9345, radiusMi: 14 },
  { name: "Wichita KS", lat: 37.6872, lng: -97.3301, radiusMi: 14 },
  { name: "Fargo ND", lat: 46.8772, lng: -96.7898, radiusMi: 12 },
  { name: "Sioux Falls SD", lat: 43.5446, lng: -96.7311, radiusMi: 12 },
  // — South Central —
  { name: "Houston TX", lat: 29.7604, lng: -95.3698, radiusMi: 22 },
  { name: "Dallas TX", lat: 32.7767, lng: -96.797, radiusMi: 20 },
  { name: "San Antonio TX", lat: 29.4241, lng: -98.4936, radiusMi: 18 },
  { name: "Austin TX", lat: 30.2672, lng: -97.7431, radiusMi: 18 },
  { name: "Oklahoma City OK", lat: 35.4676, lng: -97.5164, radiusMi: 18 },
  { name: "Little Rock AR", lat: 34.7465, lng: -92.2896, radiusMi: 16 },
  // — Mountain / West —
  { name: "Denver CO", lat: 39.7392, lng: -104.9903, radiusMi: 18 },
  { name: "Phoenix AZ", lat: 33.4484, lng: -112.074, radiusMi: 22 },
  { name: "Albuquerque NM", lat: 35.0844, lng: -106.6504, radiusMi: 16 },
  { name: "Las Vegas NV", lat: 36.1699, lng: -115.1398, radiusMi: 18 },
  { name: "Salt Lake City UT", lat: 40.7608, lng: -111.891, radiusMi: 16 },
  { name: "Boise ID", lat: 43.615, lng: -116.2023, radiusMi: 16 },
  { name: "Billings MT", lat: 45.7833, lng: -108.5007, radiusMi: 12 },
  { name: "Cheyenne WY", lat: 41.14, lng: -104.8202, radiusMi: 10 },
  // — Pacific —
  { name: "Los Angeles CA", lat: 34.0522, lng: -118.2437, radiusMi: 20 },
  { name: "San Diego CA", lat: 32.7157, lng: -117.1611, radiusMi: 16 },
  { name: "San Francisco CA", lat: 37.7749, lng: -122.4194, radiusMi: 14 },
  { name: "Sacramento CA", lat: 38.5816, lng: -121.4944, radiusMi: 16 },
  { name: "Portland OR", lat: 45.5152, lng: -122.6784, radiusMi: 16 },
  { name: "Seattle WA", lat: 47.6062, lng: -122.3321, radiusMi: 16 },
  { name: "Spokane WA", lat: 47.6588, lng: -117.426, radiusMi: 14 },
  { name: "Anchorage AK", lat: 61.2181, lng: -149.9003, radiusMi: 16 },
  { name: "Honolulu HI", lat: 21.3099, lng: -157.8581, radiusMi: 12 },
];

/** Areas to harvest: REDFIN_AREAS override (or augment) the built-in metro seed. */
export function configuredAreas(): RedfinArea[] {
  const raw = (process.env.REDFIN_AREAS || "").trim();
  if (!raw) return SEED_AREAS;
  const parsed: RedfinArea[] = [];
  for (const chunk of raw.split(",")) {
    const [name, lat, lng, r] = chunk.split("|").map((x) => x.trim());
    const la = Number(lat),
      ln = Number(lng),
      rad = Number(r);
    if (
      name &&
      Number.isFinite(la) &&
      Number.isFinite(ln) &&
      Number.isFinite(rad)
    )
      parsed.push({ name, lat: la, lng: ln, radiusMi: rad });
  }
  return parsed.length ? parsed : SEED_AREAS;
}

interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Bounding box around a center point. Longitude degrees shrink with latitude (cos), so we correct. */
export function areaToBBox(a: RedfinArea): BBox {
  const dLat = a.radiusMi / 69; // ~69 mi per degree latitude
  const dLng =
    a.radiusMi / (69 * Math.max(0.1, Math.cos((a.lat * Math.PI) / 180)));
  return {
    west: a.lng - dLng,
    south: a.lat - dLat,
    east: a.lng + dLng,
    north: a.lat + dLat,
  };
}

/** Redfin's `poly` param: "lng lat,lng lat,…" closed ring (SW→SE→NE→NW→SW). */
function polyOf(b: BBox): string {
  const f = (n: number) => n.toFixed(6);
  return [
    `${f(b.west)} ${f(b.south)}`,
    `${f(b.east)} ${f(b.south)}`,
    `${f(b.east)} ${f(b.north)}`,
    `${f(b.west)} ${f(b.north)}`,
    `${f(b.west)} ${f(b.south)}`,
  ].join(",");
}

/** Split a box into 4 quadrants (used when a box hits Redfin's 350-row cap and is likely truncated). */
function quarters(b: BBox): BBox[] {
  const mx = (b.west + b.east) / 2;
  const my = (b.south + b.north) / 2;
  return [
    { west: b.west, south: b.south, east: mx, north: my },
    { west: mx, south: b.south, east: b.east, north: my },
    { west: b.west, south: my, east: mx, north: b.north },
    { west: mx, south: my, east: b.east, north: b.north },
  ];
}

function gisUrl(b: BBox, opts: { soldWithinDays?: number } = {}): string {
  const p = new URLSearchParams({
    al: "1",
    num_homes: String(MAX_ROWS),
    ord: "redfin-recommended-asc",
    page_number: "1",
    poly: polyOf(b),
    sf: "1,2,3,5,6,7",
    status: "9",
    uipt: "1,2,3,4,5,6,7,8",
    v: "8",
  });
  if (opts.soldWithinDays)
    p.set("sold_within_days", String(opts.soldWithinDays));
  return `https://www.redfin.com/stingray/api/gis-csv?${p.toString()}`;
}

// ── CSV parsing ────────────────────────────────────────────────────────────
/** Parse one CSV line into fields, honoring "double-quoted, comma-containing" values + "" escapes. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function classify(raw: string): Property["property_type"] {
  const s = raw.toLowerCase();
  if (/multi|duplex|triplex|fourplex/.test(s)) return "multi_family";
  if (/condo|co-op|coop/.test(s)) return "condo";
  if (/town/.test(s)) return "townhouse";
  if (/land|lot|vacant/.test(s)) return "land";
  if (/mobile|manufactured/.test(s)) return "mobile";
  if (/single|residential|ranch/.test(s)) return "single_family";
  return undefined;
}

const numOf = (v: string | undefined): number | undefined => {
  if (!v) return undefined;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
// Coordinates can be negative (US longitudes) — allow the full range, reject only blank/NaN/0.
const coordOf = (v: string | undefined): number | undefined => {
  if (!v) return undefined;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : undefined;
};
const txt = (v: string | undefined): string | undefined => {
  const s = (v || "").trim();
  return s || undefined;
};

/**
 * Parse a Redfin gis-csv body into HomeIQ Properties. `wantSold` selects PAST SALE comp rows; otherwise
 * only active/coming-soon MLS listings are returned. Keys columns by HEADER NAME (resilient to reorder).
 */
export function parseRedfinCsv(csv: string, wantSold = false): Property[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];
  // The header is the first line that actually contains the ADDRESS column (Redfin prepends a disclaimer
  // line on some responses).
  const headerIdx = lines.findIndex((l) => /(^|,)ADDRESS(,|$)/i.test(l));
  if (headerIdx < 0) return [];
  const header = parseCsvLine(lines[headerIdx]).map((h) =>
    h.trim().toUpperCase(),
  );
  const col = (name: string) =>
    header.findIndex((h) => h === name || h.startsWith(name));
  const idx = {
    saleType: col("SALE TYPE"),
    type: col("PROPERTY TYPE"),
    address: col("ADDRESS"),
    city: col("CITY"),
    state: col("STATE OR PROVINCE"),
    zip: col("ZIP OR POSTAL CODE"),
    price: col("PRICE"),
    beds: col("BEDS"),
    baths: col("BATHS"),
    sqft: col("SQUARE FEET"),
    lot: col("LOT SIZE"),
    year: col("YEAR BUILT"),
    dom: col("DAYS ON MARKET"),
    ppsf: col("$/SQUARE FEET"),
    hoa: col("HOA"),
    status: col("STATUS"),
    url: col("URL"),
    source: col("SOURCE"),
    mls: col("MLS#"),
    lat: col("LATITUDE"),
    lng: col("LONGITUDE"),
  };
  if (idx.address < 0 || idx.url < 0) return [];

  const out: Property[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const at = (n: number) => (n >= 0 ? f[n] : undefined);
    const saleType = (at(idx.saleType) || "").toLowerCase();
    const isSold = saleType.includes("past") || saleType.includes("sold");
    if (wantSold !== isSold) continue;

    const url = txt(at(idx.url));
    const address = txt(at(idx.address));
    if (!url || !address) continue;

    const signals: Record<string, unknown> = { mls: true };
    const mlsNum = txt(at(idx.mls));
    if (mlsNum) signals.mls_number = mlsNum;
    const brokerage = txt(at(idx.source));
    if (brokerage) signals.brokerage = brokerage;
    const status = txt(at(idx.status));
    if (status) signals.status = status;
    const dom = numOf(at(idx.dom));
    if (dom != null) signals.days_on_market = dom;
    const ppsf = numOf(at(idx.ppsf));
    if (ppsf != null) signals.price_per_sqft = ppsf;
    if (isSold) signals.sold = true;

    out.push({
      source: wantSold ? "redfin_sold" : "redfin",
      source_listing_id: stableId(url, wantSold ? "redfin_sold" : "redfin"),
      source_url: url.startsWith("http") ? url : `https://www.redfin.com${url}`,
      title: [address, txt(at(idx.city)), txt(at(idx.state))]
        .filter(Boolean)
        .join(", "),
      property_type: classify(at(idx.type) || ""),
      address,
      city: txt(at(idx.city)),
      state: txt(at(idx.state)),
      zip: txt(at(idx.zip))?.slice(0, 5),
      lat: coordOf(at(idx.lat)),
      lng: coordOf(at(idx.lng)),
      price: numOf(at(idx.price)),
      beds: numOf(at(idx.beds)),
      baths: numOf(at(idx.baths)),
      sqft: numOf(at(idx.sqft)),
      year_built: numOf(at(idx.year)),
      seller_type: "agent",
      signals,
      scraped_at: new Date().toISOString(),
    });
  }
  return out;
}

async function fetchCsv(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/csv,*/*" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const body = await res.text();
    return /(^|,)ADDRESS(,|$)/i.test(body) ? body : null;
  } catch {
    return null;
  }
}

/** Fetch one box; if it hits the row cap, quad-subdivide (bounded depth) so nothing is silently truncated. */
async function harvestBox(
  b: BBox,
  byId: Map<string, Property>,
  opts: { wantSold?: boolean; depth?: number; deadline?: number } = {},
): Promise<void> {
  const depth = opts.depth ?? 0;
  const csv = await fetchCsv(
    gisUrl(b, opts.wantSold ? { soldWithinDays: 90 } : {}),
  );
  if (!csv) return;
  const rows = parseRedfinCsv(csv, opts.wantSold);
  for (const p of rows) byId.set(p.source_listing_id!, p);
  // Truncated box → recurse into quadrants (cap depth so we don't fan out forever on ultra-dense cores).
  // Stop subdividing once the run's time budget is spent so one dense metro can't starve the rest.
  if (
    rows.length >= CAP_HIT &&
    depth < 3 &&
    !(opts.deadline && Date.now() > opts.deadline)
  ) {
    for (const q of quarters(b)) {
      await new Promise((r) => setTimeout(r, 250)); // polite spacing per box
      await harvestBox(q, byId, { ...opts, depth: depth + 1 });
    }
  }
}

// A budgeted, rotating national sweep. Each run starts at a different metro (rotation by clock) and stops
// when the time budget is spent — so any single run is bounded (safe under the 300s serverless route) while
// successive runs cycle through the whole country (upsert dedupes across runs → full national coverage over
// time). The always-on worker can raise REDFIN_TIME_BUDGET_MS to sweep everything in one pass.
function rotated<T>(items: T[]): T[] {
  if (items.length < 2) return items;
  const offset = Math.floor(Date.now() / 60_000) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

async function sweep(
  areas: RedfinArea[],
  wantSold: boolean,
): Promise<Property[]> {
  const budgetMs = Math.max(
    20_000,
    parseInt(process.env.REDFIN_TIME_BUDGET_MS || "240000", 10) || 240_000,
  );
  const maxAreas = Math.max(
    1,
    parseInt(process.env.REDFIN_MAX_AREAS || String(areas.length), 10) ||
      areas.length,
  );
  const deadline = Date.now() + budgetMs;
  const order = rotated(areas).slice(0, maxAreas);
  const byId = new Map<string, Property>();
  let covered = 0;
  for (const a of order) {
    if (Date.now() > deadline) break;
    try {
      await harvestBox(areaToBBox(a), byId, { wantSold, deadline });
      covered++;
    } catch (e) {
      console.warn(
        `[HomeIQ:RedfinGIS] ${a.name} failed:`,
        (e as Error).message,
      );
    }
    await new Promise((r) => setTimeout(r, 400)); // pace between metros
  }
  const out = Array.from(byId.values());
  console.log(
    `[HomeIQ:RedfinGIS] ${out.length} ${wantSold ? "sold comps" : "MLS listings"} across ${covered}/${order.length} areas (budget ${Math.round(budgetMs / 1000)}s)`,
  );
  return out;
}

/** Harvest active/coming-soon MLS listings across the configured areas. Free, no anti-bot, nationwide. */
export async function harvestRedfinGis(
  areas: RedfinArea[] = configuredAreas(),
): Promise<Property[]> {
  return sweep(areas, false);
}

/** Sold comps (last 90d) for the valuation layer — anchors sell-estimates to real closed prices. */
export async function harvestRedfinSold(
  areas: RedfinArea[] = configuredAreas(),
): Promise<Property[]> {
  return sweep(areas, true);
}
