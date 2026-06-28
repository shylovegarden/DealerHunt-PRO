// lib/housing/arv-psf.ts
//
// The ARV $/sqft lookup the deal-analyzer prefers: real median *sale* price per sqft per state, snapshotted
// from Redfin's free Data Center by scripts/fetch-redfin-ppsf.ts. A static JSON import (universal, no I/O at
// call time) so analyzeHousingDeal stays pure and fast. Returns null for states absent from the snapshot so
// the analyzer can fall back to its coarse hardcoded reference. Refresh monthly: `npm run data:ppsf`.

import statePpsf from "./data/state-ppsf.json";

const BY_STATE: Record<string, number> =
  (statePpsf as { byState?: Record<string, number> }).byState || {};

export const PPSF_UPDATED: string =
  (statePpsf as { updated?: string }).updated || "";

/** Median sale $/sqft for a state (real Redfin sold data), or null if not in the snapshot. */
export function marketPsf(stateCode?: string): number | null {
  if (!stateCode) return null;
  const v = BY_STATE[stateCode.toUpperCase()];
  return typeof v === "number" && v > 0 ? v : null;
}
