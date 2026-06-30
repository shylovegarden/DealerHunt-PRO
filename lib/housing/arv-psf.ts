// lib/housing/arv-psf.ts
//
// The ARV $/sqft lookup the deal-analyzer prefers: real median *sale* price per sqft, snapshotted from
// Redfin's free Data Center. COUNTY-level first (most precise — county medians swing from ~$120 rural to
// ~$900 metro within one state), via a zip→county crosswalk, then STATE-level, then null so the analyzer
// falls back to its coarse hardcoded table. Static JSON imports (no call-time I/O) so analyzeHousingDeal
// stays pure. Refresh: `npm run data:ppsf` (state) + `npm run data:county-ppsf` (county).

import statePpsf from "./data/state-ppsf.json";
import countyPpsf from "./data/county-ppsf.json";
import zipCounty from "./data/zip-county.json";

type PpsfByType = Record<string, number>;

const BY_STATE: Record<string, PpsfByType> =
  (statePpsf as { byState?: Record<string, PpsfByType> }).byState || {};
const BY_COUNTY: Record<string, PpsfByType> =
  (countyPpsf as { byCounty?: Record<string, PpsfByType> }).byCounty || {};
const ZIP_COUNTY: Record<string, string> =
  (zipCounty as { byZip?: Record<string, string> }).byZip || {};

export const PPSF_UPDATED: string =
  (statePpsf as { updated?: string }).updated || "";

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
 * Median sale $/sqft WITH its granularity, most-precise-first: county (zip→county) → state → null. The
 * `level` tells callers how much to trust it — a COUNTY median is comp-grade; a STATE median is a coarse
 * regional guess (a Detroit land-bank shell and a Birmingham metro condo share one statewide number), so
 * ARV built on it must NOT be presented as a verified flip.
 */
export function marketPsfDetailed(
  stateCode?: string,
  propertyType?: string,
  zip?: string | null,
): { psf: number; level: "county" | "state" } | null {
  const st = (stateCode || "").toUpperCase();
  if (!st) return null;

  // County-level first (most precise).
  if (zip) {
    const county = ZIP_COUNTY[String(zip).trim().slice(0, 5)];
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
