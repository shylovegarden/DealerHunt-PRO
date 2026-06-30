// lib/housing/arv-psf.ts
//
// The ARV $/sqft lookup the deal-analyzer prefers: real median *sale* price per sqft, snapshotted from
// Redfin's free Data Center. COUNTY-level first (most precise — county medians swing from ~$120 rural to
// ~$900 metro within one state), via a zip→county crosswalk, then STATE-level, then null so the analyzer
// falls back to its coarse hardcoded table. Static JSON imports (no call-time I/O) so analyzeHousingDeal
// stays pure. Refresh: `npm run data:ppsf` (state) + `npm run data:county-ppsf` (county).

import statePpsf from "./data/state-ppsf.json";
import countyPpsf from "./data/county-ppsf.json";
import zipPpsf from "./data/zip-ppsf.json";
import zipCounty from "./data/zip-county.json";

type PpsfByType = Record<string, number>;

const BY_STATE: Record<string, PpsfByType> =
  (statePpsf as { byState?: Record<string, PpsfByType> }).byState || {};
const BY_COUNTY: Record<string, PpsfByType> =
  (countyPpsf as { byCounty?: Record<string, PpsfByType> }).byCounty || {};
const BY_ZIP: Record<string, PpsfByType> =
  (zipPpsf as { byZip?: Record<string, PpsfByType> }).byZip || {};
const ZIP_COUNTY: Record<string, string> =
  (zipCounty as { byZip?: Record<string, string> }).byZip || {};

export const PPSF_UPDATED: string =
  (statePpsf as { updated?: string }).updated || "";

// ── LIVE tier (injectable) ──────────────────────────────────────────────────
// Fresh median SOLD $/sqft per ZIP, computed from OUR live harvest (lib/housing/live-psf.ts) and injected
// here so the static JSON snapshots stay the floor, not the ceiling. This is how pricing LEARNS from the
// harvest: when the live map has a ZIP, it wins over the periodic snapshot (it's the same kind of data —
// median sold $/sqft — only fresher). Set once per harvest (worker) and per request (cached). Pure reads
// at call time; the map is a module-level ref so analyzeHousingDeal stays synchronous.
let LIVE_BY_ZIP: Record<string, PpsfByType> = {};
export function setLiveZipPsf(byZip: Record<string, PpsfByType>): void {
  LIVE_BY_ZIP = byZip || {};
}
export function liveZipCount(): number {
  return Object.keys(LIVE_BY_ZIP).length;
}

// Normalize a county name to match the county-ppsf keys ("Cook County" → "cook county").
function normCounty(name: string): string {
  return name
    .replace(/,\s*[A-Za-z]{2}\s*$/, "")
    .trim()
    .toLowerCase();
}

// Pick the property-type-specific $/sqft, falling back to the all-residential aggregate.
function pick(byType?: PpsfByType, propertyType?: string): number | null {
  if (!byType) return null;
  const typed = propertyType ? byType[propertyType] : undefined;
  const v = typeof typed === "number" && typed > 0 ? typed : byType.all;
  return typeof v === "number" && v > 0 ? v : null;
}

/**
 * Median sale $/sqft WITH its granularity, most-precise-first: ZIP → county (zip→county) → state → null.
 * The `level` tells callers how much to trust it — a ZIP median is the tightest free comp (street-level),
 * a COUNTY median is comp-grade, a STATE median is a coarse regional guess (a Detroit land-bank shell and a
 * Birmingham metro condo share one statewide number) so ARV built on it must NOT be presented as a flip.
 */
export function marketPsfDetailed(
  stateCode?: string,
  propertyType?: string,
  zip?: string | null,
): { psf: number; level: "zip" | "county" | "state" } | null {
  const st = (stateCode || "").toUpperCase();
  const z = zip ? String(zip).trim().slice(0, 5) : null;

  // LIVE ZIP first — our own fresh harvested sold $/sqft (when present) beats the periodic snapshot.
  if (z) {
    const lv = pick(LIVE_BY_ZIP[z], propertyType);
    if (lv != null) return { psf: lv, level: "zip" };
  }
  // Static ZIP snapshot next (tightest committed comp — works even when we don't know the state).
  if (z) {
    const v = pick(BY_ZIP[z], propertyType);
    if (v != null) return { psf: v, level: "zip" };
  }
  if (!st) return null;

  // County-level next (zip→county crosswalk).
  if (z) {
    const county = ZIP_COUNTY[z];
    if (county) {
      const v = pick(BY_COUNTY[`${normCounty(county)}|${st}`], propertyType);
      if (v != null) return { psf: v, level: "county" };
    }
  }

  // State-level fallback (coarse).
  const sv = pick(BY_STATE[st], propertyType);
  return sv != null ? { psf: sv, level: "state" } : null;
}

/** Median sale $/sqft for a property (county → state → null). See marketPsfDetailed for granularity. */
export function marketPsf(
  stateCode?: string,
  propertyType?: string,
  zip?: string | null,
): number | null {
  return marketPsfDetailed(stateCode, propertyType, zip)?.psf ?? null;
}
