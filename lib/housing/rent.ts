// lib/housing/rent.ts
//
// The buy-and-hold leg of HomeIQ — turns a price + ZIP into the rental-investor metrics (cap rate, gross
// rent multiplier, monthly cashflow) using the free Zillow ZORI rent snapshot (data/zip-rent.json). Flips
// ask "what's the spread"; landlords ask "does it cashflow" — this answers the second. Coarse but real (a
// ZIP-typical market rent, like the $/sqft is a ZIP-typical sale), and clearly flagged as such.
//
// Standard REI math: the 50% rule (operating expenses ≈ half of rent) → NOI = annual rent × 0.5;
// cap rate = NOI / price; GRM = price / annual rent. Pure, no I/O at call time (static JSON import).

import zipRent from "./data/zip-rent.json";

const BY_ZIP: Record<string, number> =
  (zipRent as { byZip?: Record<string, number> }).byZip || {};
export const RENT_UPDATED: string =
  (zipRent as { latestMonth?: string }).latestMonth || "";

/** Latest typical market rent ($/mo) for a 5-digit ZIP, or null when the ZIP isn't in the snapshot. */
export function rentForZip(zip?: string | null): number | null {
  if (!zip) return null;
  const r = BY_ZIP[String(zip).trim().slice(0, 5)];
  return typeof r === "number" && r > 0 ? r : null;
}

export interface RentCashflow {
  monthlyRent: number;
  annualRent: number;
  grossYieldPct: number; // annual rent / price
  capRatePct: number; // NOI (50% rule) / price
  monthlyCashflow: number; // NOI/12 (before debt service — an all-cash proxy)
  rating: "strong" | "decent" | "thin" | "negative";
  note: string;
}

/**
 * Rental-investor view of a price + ZIP. Uses the ZIP's typical market rent and the 50% rule. `price` should
 * be the all-in basis (purchase + rehab) when known; pass it via opts.basis, else the ask is used. Returns
 * null when there's no rent for the ZIP or no usable price.
 */
export function rentCashflow(
  price?: number | null,
  zip?: string | null,
  opts: { basis?: number } = {},
): RentCashflow | null {
  const rent = rentForZip(zip);
  const basis = Math.round(opts.basis ?? price ?? 0);
  if (!rent || basis <= 0) return null;

  const annualRent = rent * 12;
  const noi = annualRent * 0.5; // 50% rule (taxes/insurance/maintenance/vacancy/mgmt)
  const capRatePct = Math.round((noi / basis) * 1000) / 10;
  const grossYieldPct = Math.round((annualRent / basis) * 1000) / 10;
  const monthlyCashflow = Math.round(noi / 12);

  let rating: RentCashflow["rating"];
  if (capRatePct >= 8) rating = "strong";
  else if (capRatePct >= 6) rating = "decent";
  else if (capRatePct >= 4) rating = "thin";
  else rating = "negative";

  return {
    monthlyRent: rent,
    annualRent,
    grossYieldPct,
    capRatePct,
    monthlyCashflow,
    rating,
    note: `Rent ≈ $${rent.toLocaleString()}/mo (ZIP ${String(zip).slice(0, 5)}); cap rate ${capRatePct}% (50% rule) on $${basis.toLocaleString()}`,
  };
}
