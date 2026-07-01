import { describe, it, expect } from "vitest";
import { holdingCost } from "./holding-cost";

describe("holdingCost", () => {
  it("returns null for a non-positive price", () => {
    expect(holdingCost({ price: 0 })).toBeNull();
  });

  it("sums taxes + insurance + utilities + financing per month, × months for total", () => {
    const h = holdingCost({
      price: 100_000,
      repairEstimate: 20_000,
      months: 6,
      hardMoneyApr: 0.12,
    })!;
    // taxes est: 100k×1.1%/12 = 91.67→92; insurance 1500/12=125; utilities 150;
    // financing: 120k×12%/12 = 1200. perMonth = 92+125+150+1200 = 1567.
    expect(h.breakdown.financing).toBe(1200);
    expect(h.breakdown.utilities).toBe(150);
    expect(h.perMonth).toBe(
      h.breakdown.taxes +
        h.breakdown.insurance +
        h.breakdown.utilities +
        h.breakdown.financing,
    );
    expect(h.total).toBe(h.perMonth * 6);
    expect(h.taxesEstimated).toBe(true);
  });

  it("uses a real annual tax figure when provided (not estimated)", () => {
    const h = holdingCost({ price: 100_000, annualTaxes: 3600 })!;
    expect(h.taxesEstimated).toBe(false);
    expect(h.breakdown.taxes).toBe(300); // 3600/12
  });

  it("defaults to a sane hold length", () => {
    const h = holdingCost({ price: 50_000 })!;
    expect(h.months).toBeGreaterThanOrEqual(1);
    expect(h.total).toBe(h.perMonth * h.months);
  });
});
