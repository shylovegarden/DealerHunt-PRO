// lib/housing/sources/fema-flood.ts
//
// FEMA flood-zone lookup — a property in a Special Flood Hazard Area (Zone A*/V*) needs $1-4k/yr of flood
// insurance, which quietly kills buy-and-hold ROI and shrinks the buyer pool on resale. We flag it from
// FEMA's free, keyless National Flood Hazard Layer (NFHL) by lat/lng. Best-effort + cached + short timeout
// so it never blocks a page; returns null when unknown (never guesses a zone). Verified live against the
// NFHL MapServer (layer 28 = flood hazard zones).

const NFHL =
  "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";

// Special Flood Hazard Areas (1%-annual-chance floodplain) — insurance is mandatory with a federal
// mortgage here. "X"/"D"/etc. are minimal/undetermined.
const SFHA = /^(A|AE|AH|AO|AR|A99|V|VE)$/i;

export interface FloodZone {
  zone: string; // e.g. "AE", "X", "VE"
  /** True for a Special Flood Hazard Area — mandatory flood insurance, materially worse for a hold. */
  high: boolean;
  label: string;
}

/** Classify a raw NFHL FLD_ZONE string. Exported + pure so it's unit-testable without a network call. */
export function classifyFloodZone(raw?: string | null): FloodZone | null {
  const zone = String(raw || "")
    .trim()
    .toUpperCase();
  if (!zone) return null;
  const high = SFHA.test(zone);
  return {
    zone,
    high,
    label: high
      ? `Flood zone ${zone} — mandatory flood insurance`
      : `Flood zone ${zone} — minimal risk`,
  };
}

const cache = new Map<string, FloodZone | null>();

/**
 * Look up the FEMA flood zone at a coordinate. Best-effort: short timeout, cached by rounded lat/lng,
 * returns null on any error or when the point isn't mapped (so callers show nothing rather than a guess).
 */
export async function floodZone(
  lat?: number | null,
  lng?: number | null,
  timeoutMs = 2500,
): Promise<FloodZone | null> {
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  )
    return null;
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key)!;

  const url =
    `${NFHL}?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326` +
    `&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE&returnGeometry=false&f=json`;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = (await res.json()) as {
      features?: { attributes?: { FLD_ZONE?: string } }[];
    };
    const raw = data.features?.[0]?.attributes?.FLD_ZONE;
    const fz = classifyFloodZone(raw);
    cache.set(key, fz);
    return fz;
  } catch {
    cache.set(key, null);
    return null;
  }
}
