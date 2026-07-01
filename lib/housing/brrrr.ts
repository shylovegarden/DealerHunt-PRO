// lib/housing/brrrr.ts
//
// BRRRR (Buy-Rehab-Rent-Refinance-Repeat) — the investor exit the flip math ignores: instead of selling,
// you refinance at ~75% of ARV, pull most of your capital back out, and hold the rental. The key numbers
// are "how much cash stays stuck in the deal" and the cash-on-cash return on it — and the holy grail, an
// "infinite return" when the refi pulls ALL your capital back. Pure + tested. Uses the SAME real inputs as
// the rest of HomeIQ: comp-driven ARV, ZORI rent, our repair estimate. Assumptions (LTV, refi rate) are
// labeled — no live lender feed.

export interface BrrrrInput {
  price: number;
  repairEstimate: number;
  arv: number;
  monthlyRent: number;
  /** Cash-out refinance loan-to-value. Default 75% — the standard investor-refi ceiling. */
  refiLtv?: number;
  /** Refi APR (30-yr amortized). Default 7.5%. */
  refiApr?: number;
}

export interface BrrrrResult {
  allIn: number; // purchase + rehab
  refiLoan: number; // ARV × LTV
  cashOut: number; // proceeds from the refi (= refiLoan)
  cashLeftIn: number; // capital still stuck (allIn − cashOut), floored at 0
  monthlyDebtService: number; // amortized P&I on the refi loan
  monthlyCashflow: number; // NOI (50% rule) − debt service
  cashOnCashPct: number | null; // annual cashflow / cash-left-in (null when full BRRRR)
  fullBrrrr: boolean; // refi pulled ALL capital back → infinite return
  notes: string[];
}

/** Standard fully-amortizing monthly payment. */
function amortized(principal: number, apr: number, years = 30): number {
  const r = apr / 12;
  const n = years * 12;
  if (r <= 0) return principal / n;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

/**
 * Model the refinance-and-hold exit. Returns null when the inputs aren't there (needs a real ARV + rent).
 */
export function brrrrAnalysis(input: BrrrrInput): BrrrrResult | null {
  const price = Math.round(input.price || 0);
  const arv = Math.round(input.arv || 0);
  const rent = Math.round(input.monthlyRent || 0);
  if (price <= 0 || arv <= 0 || rent <= 0) return null;

  const repairs = Math.max(0, Math.round(input.repairEstimate || 0));
  const ltv = input.refiLtv ?? 0.75;
  const apr = input.refiApr ?? 0.075;

  const allIn = price + repairs;
  const refiLoan = Math.round(arv * ltv);
  const cashOut = refiLoan;
  const cashLeftIn = Math.max(0, allIn - cashOut);
  const fullBrrrr = cashOut >= allIn;

  const monthlyDebtService = Math.round(amortized(refiLoan, apr));
  // NOI on the 50% rule (taxes/ins/maintenance/vacancy ≈ half of rent), minus the new debt service.
  const monthlyCashflow = Math.round(rent * 0.5 - monthlyDebtService);
  const cashOnCashPct = fullBrrrr
    ? null // capital fully recovered → return is "infinite" on $0 left in
    : Math.round(((monthlyCashflow * 12) / cashLeftIn) * 1000) / 10;

  const notes = [
    `Refi at ${Math.round(ltv * 100)}% of ARV, ${Math.round(apr * 100)}% 30-yr`,
    "Operating costs via the 50% rule (no live lender/insurance feed)",
  ];

  return {
    allIn,
    refiLoan,
    cashOut,
    cashLeftIn,
    monthlyDebtService,
    monthlyCashflow,
    cashOnCashPct,
    fullBrrrr,
    notes,
  };
}
