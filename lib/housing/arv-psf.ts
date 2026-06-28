// lib/housing/arv-psf.ts
//
// The ARV $/sqft lookup the deal-analyzer prefers: real median *sale* price per sqft per state, snapshotted
// from Redfin's free Data Center by scripts/fetch-redfin-ppsf.ts. A static JSON import (universal, no I/O at
// call time) so analyzeHousingDeal stays pure and fast. Returns null for states absent from the snapshot so
// the analyzer can fall back to its coarse hardcoded reference. Refresh monthly: `npm run data:ppsf`.

import statePpsf from "./data/state-ppsf.json";

type PpsfByType = Record<string, number>;

const BY_STATE: Record<string, PpsfByType> =
  (statePpsf as { byState?: Record<string, PpsfByType> }).byState || {};

export const PPSF_UPDATED: string =
  (statePpsf as { updated?: string }).updated || "";

/**
 * Median sale $/sqft for a state, preferring the property-type-specific figure (condos and single-family
 * differ a lot) and falling back to the all-residential aggregate. Returns null if the state isn't in the
 * Redfin snapshot so the analyzer can fall back to its coarse hardcoded reference.
 */
export function marketPsf(
  stateCode?: string,
  propertyType?: string,
): number | null {
  if (!stateCode) return null;
  const byType = BY_STATE[stateCode.toUpperCase()];
  if (!byType) return null;
  const typed = propertyType ? byType[propertyType] : undefined;
  const v = typeof typed === "number" && typed > 0 ? typed : byType.all;
  return typeof v === "number" && v > 0 ? v : null;
}
