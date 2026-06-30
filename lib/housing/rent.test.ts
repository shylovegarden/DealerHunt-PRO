import { describe, it, expect } from "vitest";
import { rentForZip, rentCashflow, RENT_UPDATED } from "./rent";

// Runs against the committed Zillow ZORI snapshot (data/zip-rent.json). Relationship-based assertions so a
// monthly refresh doesn't break them.
describe("rentForZip", () => {
  it("ships a dated ZIP rent snapshot", () => {
    expect(RENT_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("returns a positive rent for a populated ZIP", () => {
    expect(rentForZip("30303")).toBeGreaterThan(0); // downtown Atlanta
  });
  it("returns null for an unknown ZIP", () => {
    expect(rentForZip("00000")).toBeNull();
    expect(rentForZip(undefined)).toBeNull();
  });
});

describe("rentCashflow", () => {
  it("computes cap rate from the 50% rule and rates it", () => {
    const rent = rentForZip("30303")!;
    // Price set so NOI/price ≈ 10% → strong.
    const price = Math.round(rent * 12 * 0.5 * 10); // capRate = 10%
    const cf = rentCashflow(price, "30303")!;
    expect(cf.monthlyRent).toBe(rent);
    expect(cf.capRatePct).toBeCloseTo(10, 0);
    expect(cf.rating).toBe("strong");
    expect(cf.monthlyCashflow).toBeGreaterThan(0);
  });

  it("rates an overpriced (low-yield) buy as negative", () => {
    const rent = rentForZip("30303")!;
    const cf = rentCashflow(rent * 12 * 0.5 * 40, "30303")!; // ~2.5% cap
    expect(cf.rating).toBe("negative");
  });

  it("uses the all-in basis (purchase + rehab) when provided", () => {
    const ask = rentCashflow(100000, "30303")!;
    const allIn = rentCashflow(100000, "30303", { basis: 200000 })!;
    expect(allIn.capRatePct).toBeLessThan(ask.capRatePct); // higher basis → lower yield
  });

  it("returns null without rent or price", () => {
    expect(rentCashflow(100000, "00000")).toBeNull();
    expect(rentCashflow(0, "30303")).toBeNull();
  });
});
