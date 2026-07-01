import { describe, it, expect } from "vitest";
import { brrrrAnalysis } from "./brrrr";

describe("brrrrAnalysis", () => {
  it("returns null without a real ARV + rent", () => {
    expect(
      brrrrAnalysis({
        price: 50000,
        repairEstimate: 20000,
        arv: 0,
        monthlyRent: 0,
      }),
    ).toBeNull();
  });

  it("computes cash-left-in and cash-on-cash on a partial BRRRR", () => {
    // all-in 90k; ARV 150k; refi 75% = 112.5k → pulls out MORE than all-in → full BRRRR here.
    // Use a tighter deal so capital stays in: all-in 120k, ARV 140k → refi 105k → 15k left in.
    const r = brrrrAnalysis({
      price: 100000,
      repairEstimate: 20000,
      arv: 140000,
      monthlyRent: 1600,
    })!;
    expect(r.allIn).toBe(120000);
    expect(r.refiLoan).toBe(105000);
    expect(r.cashLeftIn).toBe(15000);
    expect(r.fullBrrrr).toBe(false);
    expect(typeof r.cashOnCashPct).toBe("number");
  });

  it("flags a full BRRRR (infinite return) when the refi recovers all capital", () => {
    // all-in 90k; ARV 150k → refi 112.5k ≥ 90k → all capital back, cashLeftIn 0.
    const r = brrrrAnalysis({
      price: 70000,
      repairEstimate: 20000,
      arv: 150000,
      monthlyRent: 1500,
    })!;
    expect(r.fullBrrrr).toBe(true);
    expect(r.cashLeftIn).toBe(0);
    expect(r.cashOnCashPct).toBeNull();
  });

  it("subtracts amortized debt service from NOI for cashflow", () => {
    const r = brrrrAnalysis({
      price: 100000,
      repairEstimate: 20000,
      arv: 140000,
      monthlyRent: 1600,
    })!;
    // NOI = 1600×0.5 = 800; cashflow = 800 − debtService.
    expect(r.monthlyCashflow).toBe(800 - r.monthlyDebtService);
  });
});
