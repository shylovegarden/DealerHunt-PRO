// lib/housing/holding-cost.ts
//
// The TIME cost of a flip — what every month of holding actually costs, which the raw 70%-rule MAO ignores.
// A deal with a fat equity spread can still be thin once you pay taxes + insurance + utilities + hard-money
// interest for the months it takes to rehab and sell. This turns those into an honest per-month + total
// number so the user sees the REAL margin, not the gross one. Pure + tested. Every rate is a labeled
// assumption (we don't have a live insurance/rate feed) — the UI must present it as an estimate, not a fact.

export interface HoldingCostInput {
  price: number;
  repairEstimate?: number | null;
  /** Real annual property tax if a source carries it; else we estimate from price. */
  annualTaxes?: number | null;
  /** Hard-money APR on the all-in basis (purchase + repairs). Default 12% — the market rule of thumb. */
  hardMoneyApr?: number;
  /** Months held (rehab + list + close). Default 5; pass the ZIP median DOM when known for realism. */
  months?: number;
}

export interface HoldingCost {
  perMonth: number;
  months: number;
  total: number;
  breakdown: {
    taxes: number; // /mo
    insurance: number; // /mo
    utilities: number; // /mo
    financing: number; // /mo
  };
  /** True whenever the tax figure is an estimate (no real annual-tax input). */
  taxesEstimated: boolean;
  notes: string[];
}

// Assumptions (labeled). US effective property-tax ~1.1%/yr; vacant-flip insurance ~$1,500/yr; vacant
// utilities ~$150/mo. All conservative rules-of-thumb, not a live feed.
const EFFECTIVE_TAX_RATE = 0.011;
const VACANT_INSURANCE_YR = 1500;
const VACANT_UTILITIES_MO = 150;
const DEFAULT_APR = 0.12;
const DEFAULT_MONTHS = 5;

/** Estimate the monthly + total cost of holding a flip through rehab and resale. */
export function holdingCost(input: HoldingCostInput): HoldingCost | null {
  const price = Math.round(input.price || 0);
  if (price <= 0) return null;

  const repairs = Math.max(0, Math.round(input.repairEstimate || 0));
  const months = Math.max(1, Math.round(input.months ?? DEFAULT_MONTHS));
  const apr = input.hardMoneyApr ?? DEFAULT_APR;
  const notes: string[] = [];

  const taxesEstimated = !(input.annualTaxes && input.annualTaxes > 0);
  const annualTaxes = taxesEstimated
    ? Math.round(price * EFFECTIVE_TAX_RATE)
    : Math.round(input.annualTaxes!);
  notes.push(
    taxesEstimated
      ? `Taxes est. at ${(EFFECTIVE_TAX_RATE * 100).toFixed(1)}% of price/yr`
      : "Taxes from county record",
  );

  const taxes = Math.round(annualTaxes / 12);
  const insurance = Math.round(VACANT_INSURANCE_YR / 12);
  const utilities = VACANT_UTILITIES_MO;
  // Hard-money interest on the all-in basis (purchase + repairs).
  const financing = Math.round(((price + repairs) * apr) / 12);
  notes.push(
    `Financing at ${Math.round(apr * 100)}% APR on $${(price + repairs).toLocaleString()} all-in`,
  );

  const perMonth = taxes + insurance + utilities + financing;
  return {
    perMonth,
    months,
    total: perMonth * months,
    breakdown: { taxes, insurance, utilities, financing },
    taxesEstimated,
    notes,
  };
}
