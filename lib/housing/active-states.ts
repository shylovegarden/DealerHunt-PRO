import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Demand-driven harvest scope. The on-market MLS sources (Redfin GIS, portals, RESO) only cover the ACTIVE
// states — seeded MO + IL, and grown when a user selects a housing state (server power goes where the demand
// is). Off-market sources stay nationwide. If the registry is empty/unreachable we fall back to MO+IL and
// NEVER back to nationwide.

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

// Static reference data — approximate bounding boxes for all 50 states + DC. Same class as the state
// centroids we already ship; used to build a Redfin GIS harvest polygon per state (quad-subdivide handles
// density). {west=minLng, south=minLat, east=maxLng, north=maxLat}.
export const STATE_BBOX: Record<string, BBox> = {
  AL: { west: -88.47, south: 30.22, east: -84.89, north: 35.01 },
  AK: { west: -179.15, south: 51.21, east: -129.98, north: 71.44 },
  AZ: { west: -114.82, south: 31.33, east: -109.05, north: 37.0 },
  AR: { west: -94.62, south: 33.0, east: -89.64, north: 36.5 },
  CA: { west: -124.41, south: 32.53, east: -114.13, north: 42.01 },
  CO: { west: -109.06, south: 36.99, east: -102.04, north: 41.0 },
  CT: { west: -73.73, south: 40.98, east: -71.79, north: 42.05 },
  DE: { west: -75.79, south: 38.45, east: -75.05, north: 39.84 },
  DC: { west: -77.12, south: 38.79, east: -76.91, north: 38.996 },
  FL: { west: -87.63, south: 24.4, east: -80.03, north: 31.0 },
  GA: { west: -85.61, south: 30.36, east: -80.84, north: 35.0 },
  HI: { west: -160.25, south: 18.91, east: -154.8, north: 22.24 },
  ID: { west: -117.24, south: 41.99, east: -111.04, north: 49.0 },
  IL: { west: -91.51, south: 36.97, east: -87.02, north: 42.51 },
  IN: { west: -88.1, south: 37.77, east: -84.78, north: 41.76 },
  IA: { west: -96.64, south: 40.38, east: -90.14, north: 43.5 },
  KS: { west: -102.05, south: 36.99, east: -94.59, north: 40.0 },
  KY: { west: -89.57, south: 36.5, east: -81.96, north: 39.15 },
  LA: { west: -94.04, south: 28.93, east: -88.82, north: 33.02 },
  ME: { west: -71.08, south: 42.98, east: -66.95, north: 47.46 },
  MD: { west: -79.49, south: 37.91, east: -75.05, north: 39.72 },
  MA: { west: -73.51, south: 41.24, east: -69.93, north: 42.89 },
  MI: { west: -90.42, south: 41.7, east: -82.41, north: 48.31 },
  MN: { west: -97.24, south: 43.5, east: -89.49, north: 49.38 },
  MS: { west: -91.66, south: 30.17, east: -88.1, north: 35.0 },
  MO: { west: -95.77, south: 35.99, east: -89.1, north: 40.61 },
  MT: { west: -116.05, south: 44.36, east: -104.04, north: 49.0 },
  NE: { west: -104.05, south: 39.99, east: -95.31, north: 43.0 },
  NV: { west: -120.01, south: 35.0, east: -114.04, north: 42.0 },
  NH: { west: -72.56, south: 42.7, east: -70.61, north: 45.31 },
  NJ: { west: -75.56, south: 38.93, east: -73.9, north: 41.36 },
  NM: { west: -109.05, south: 31.33, east: -103.0, north: 37.0 },
  NY: { west: -79.76, south: 40.5, east: -71.86, north: 45.02 },
  NC: { west: -84.32, south: 33.84, east: -75.46, north: 36.59 },
  ND: { west: -104.05, south: 45.94, east: -96.55, north: 49.0 },
  OH: { west: -84.82, south: 38.4, east: -80.52, north: 41.98 },
  OK: { west: -103.0, south: 33.62, east: -94.43, north: 37.0 },
  OR: { west: -124.57, south: 41.99, east: -116.46, north: 46.29 },
  PA: { west: -80.52, south: 39.72, east: -74.69, north: 42.27 },
  RI: { west: -71.86, south: 41.15, east: -71.12, north: 42.02 },
  SC: { west: -83.35, south: 32.03, east: -78.54, north: 35.22 },
  SD: { west: -104.06, south: 42.48, east: -96.44, north: 45.95 },
  TN: { west: -90.31, south: 34.98, east: -81.65, north: 36.68 },
  TX: { west: -106.65, south: 25.84, east: -93.51, north: 36.5 },
  UT: { west: -114.05, south: 37.0, east: -109.04, north: 42.0 },
  VT: { west: -73.44, south: 42.73, east: -71.46, north: 45.02 },
  VA: { west: -83.68, south: 36.54, east: -75.24, north: 39.47 },
  WA: { west: -124.85, south: 45.54, east: -116.92, north: 49.0 },
  WV: { west: -82.64, south: 37.2, east: -77.72, north: 40.64 },
  WI: { west: -92.89, south: 42.49, east: -86.8, north: 47.31 },
  WY: { west: -111.06, south: 40.99, east: -104.05, north: 45.01 },
};

const FALLBACK = ["MO", "IL"]; // requirement: NEVER nationwide again

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

let cache: { at: number; states: string[] } | null = null;

/** The active harvest states, cached 60s. Falls back to MO+IL on empty/error — never nationwide. */
export async function activeStates(): Promise<string[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.states;
  try {
    const { data } = await service().from("harvest_states").select("state");
    const states = (data ?? [])
      .map((r: { state: string }) => String(r.state).toUpperCase())
      .filter((s) => STATE_BBOX[s]);
    const out = states.length ? states : FALLBACK;
    cache = { at: Date.now(), states: out };
    return out;
  } catch {
    return FALLBACK;
  }
}

/** Add a demanded state (idempotent). Called from the preferences demand hook. */
export async function addActiveState(
  state: string,
  userId?: string | null,
): Promise<void> {
  const code = String(state || "").toUpperCase();
  if (!STATE_BBOX[code]) return; // unknown code → ignore
  try {
    await service()
      .from("harvest_states")
      .upsert(
        { state: code, source: "demand", requested_by: userId ?? null },
        { onConflict: "state" },
      );
    cache = null; // invalidate so the next harvest sees it
  } catch {
    /* best-effort */
  }
}
