// lib/housing/sources/homepath.ts
//
// Fannie Mae HomePath — the GSE's bank-owned (REO) inventory. The SPA fetches listings from an OPEN JSON
// endpoint (no auth, no anti-bot): GET /cfl/property-inventory/search?bounds=south,west,north,east. Returns
// up to 400 rows per call with full structure (beds/baths/sqft/year), precise geoPoint, occupancy, and the
// First-Look (owner-occupant-only) window. REO = a motivated institutional seller → scores as bank-owned.
//
// Coverage by tiling: a coarse US grid (REO is sparse — a few thousand nationwide), quad-subdivide any box
// that hits the 400-row cap, dedupe by reoId/uuid. Verified live (docs/findings/homepath-api.md).

import type { Property } from "../types";

const BASE = "https://homepath.fanniemae.com/cfl/property-inventory/search";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CAP = 400; // API hard cap per request
const SUBDIVIDE_AT = 380; // near the cap ⇒ likely truncated → split

interface Box {
  s: number;
  w: number;
  n: number;
  e: number;
}

// Coarse continental-US grid (5 cols × 3 rows) covering CONUS; sparse REO means few boxes ever subdivide.
function usGrid(): Box[] {
  const out: Box[] = [];
  const latStops = [24, 32, 40, 49.5];
  const lngStops = [-125, -113, -101, -89, -77, -66];
  for (let i = 0; i < latStops.length - 1; i++)
    for (let j = 0; j < lngStops.length - 1; j++)
      out.push({
        s: latStops[i],
        n: latStops[i + 1],
        w: lngStops[j],
        e: lngStops[j + 1],
      });
  // Plus AK + HI.
  out.push({ s: 51, n: 71, w: -170, e: -129 }); // Alaska
  out.push({ s: 18.5, n: 22.5, w: -161, e: -154 }); // Hawaii
  return out;
}

function mapType(t?: string): Property["property_type"] {
  const s = (t || "").toLowerCase();
  if (/condo|co-?op/.test(s)) return "condo";
  if (/town/.test(s)) return "townhouse";
  if (/multi|duplex|two|three|four/.test(s)) return "multi_family";
  if (/manufactured|mobile/.test(s)) return "mobile";
  if (/land|lot|vacant/.test(s)) return "land";
  if (/single|residence|detached/.test(s)) return "single_family";
  return undefined;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
// Coordinates can be negative (US longitudes) — allow the full range, reject only blank/NaN/0.
const coord = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : undefined;
};

/** Map one HomePath listing record into a HomeIQ Property. */
export function parseHomePath(r: Record<string, any>): Property | null {
  const id = r.reoId || r.propertyUuid;
  const address = (r.addressLine1 || "").trim();
  if (!id || !address) return null;
  const geo = r.geoPoint || {};
  const firstLook = !!r.firstLookProgramIndicator;
  return {
    source: "fannie_homepath",
    source_listing_id: `fnma-${id}`,
    source_url: `https://www.homepath.com/homes/property/${r.propertyUuid}`,
    title: address,
    property_type: mapType(r.propertyType),
    address,
    city: r.city ? String(r.city).trim() : undefined,
    state: r.state ? String(r.state).trim() : undefined,
    zip: r.zipCode ? String(r.zipCode).slice(0, 5) : undefined,
    lat: coord(geo.latitude),
    lng: coord(geo.longitude),
    price: num(r.price),
    beds: num(r.bedrooms),
    baths: num(r.bathrooms),
    sqft: num(r.sqft),
    year_built: num(r.yearBuilt),
    images: r.primHiResImageUrl ? [String(r.primHiResImageUrl)] : undefined,
    seller_type: "bank",
    signals: {
      reo: true,
      fannie_homepath: true,
      status: r.propertyListingStatus || r.equatorStatusLabel,
      occupancy: r.occupancyStatusCode,
      tenant_occupied: !!r.tenantOccupied,
      // First-Look = owner-occupants/nonprofits only for a window; investors must wait — note it.
      first_look: firstLook || undefined,
      auction: !!r.auction || undefined,
    },
    scraped_at: new Date().toISOString(),
  };
}

async function fetchBox(b: Box): Promise<Record<string, any>[] | null> {
  const url = `${BASE}?bounds=${b.s},${b.w},${b.n},${b.e}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { properties?: Record<string, any>[] };
    return Array.isArray(j.properties) ? j.properties : [];
  } catch {
    return null;
  }
}

function quarters(b: Box): Box[] {
  const mx = (b.w + b.e) / 2;
  const my = (b.s + b.n) / 2;
  return [
    { s: b.s, w: b.w, n: my, e: mx },
    { s: b.s, w: mx, n: my, e: b.e },
    { s: my, w: b.w, n: b.n, e: mx },
    { s: my, w: mx, n: b.n, e: b.e },
  ];
}

async function harvestBox(
  b: Box,
  byId: Map<string, Property>,
  depth = 0,
): Promise<void> {
  const rows = await fetchBox(b);
  if (!rows) return;
  for (const r of rows) {
    const p = parseHomePath(r);
    if (p) byId.set(p.source_listing_id!, p);
  }
  if (rows.length >= SUBDIVIDE_AT && depth < 3) {
    for (const q of quarters(b)) {
      await new Promise((r) => setTimeout(r, 200));
      await harvestBox(q, byId, depth + 1);
    }
  }
}

/** Harvest the full Fannie Mae HomePath REO inventory (nationwide). Free, open JSON, no anti-bot. */
export async function harvestHomePath(): Promise<Property[]> {
  const byId = new Map<string, Property>();
  for (const b of usGrid()) {
    try {
      await harvestBox(b, byId);
    } catch (e) {
      console.warn("[HomeIQ:HomePath] box failed:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  const out = Array.from(byId.values());
  console.log(`[HomeIQ:HomePath] ${out.length} Fannie REO listings`);
  return out;
}
