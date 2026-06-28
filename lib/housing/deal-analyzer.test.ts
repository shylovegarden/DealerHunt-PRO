import { describe, it, expect } from "vitest";
import { analyzeHousingDeal, inferRehabLevel } from "./deal-analyzer";
import type { Property } from "./types";

const base: Property = {
  source: "gov_auction",
  title: "Single Family House",
  property_type: "single_family",
  price: 60000,
  state: "IL",
  sqft: 1500,
};

describe("inferRehabLevel", () => {
  it("reads distress language", () => {
    expect(
      inferRehabLevel({ ...base, title: "Deeply Discounted Fixer Rehab" }),
    ).toBe("heavy");
    expect(
      inferRehabLevel({ ...base, title: "Turnkey renovated move-in ready" }),
    ).toBe("light");
    expect(
      inferRehabLevel({ ...base, title: "Fire damage shell, gut job" }),
    ).toBe("gut");
    expect(inferRehabLevel({ ...base, title: "Single Family House" })).toBe(
      "medium",
    );
  });
});

describe("analyzeHousingDeal — 70% rule", () => {
  it("computes ARV (sqft × regional psf), repairs, and MAO", () => {
    const a = analyzeHousingDeal({
      ...base,
      sqft: 1500,
      state: "IL",
      price: 60000,
      title: "fixer",
    });
    // IL psf 180 → ARV 270k; heavy repairs 1500×60 = 90k → MAO = 270k×0.7 − 90k = 99k.
    expect(a.arv).toBe(270000);
    expect(a.repairEstimate).toBe(90000);
    expect(a.mao).toBe(99000);
    expect(a.arvConfidence).toBe("low");
    // ask 60k <= mao*0.85 (84.15k) → strong.
    expect(a.verdict).toBe("strong");
  });

  it("an explicit ARV overrides and is high-confidence", () => {
    const a = analyzeHousingDeal(
      { ...base, sqft: 1000, title: "fixer" },
      { arv: 200000 },
    );
    expect(a.arvBasis).toBe("comps");
    expect(a.arvConfidence).toBe("high");
    expect(a.mao).toBe(Math.round(200000 * 0.7 - 1000 * 60));
  });

  it("returns UNKNOWN (no guess) when sqft is missing", () => {
    const a = analyzeHousingDeal({ ...base, sqft: undefined });
    expect(a.arv).toBeNull();
    expect(a.mao).toBeNull();
    expect(a.verdict).toBe("unknown");
    expect(a.notes.join(" ")).toMatch(/needs square footage|comps/i);
  });

  it("flags an overpriced deal as pass", () => {
    // ask above ARV → pass.
    const a = analyzeHousingDeal({
      ...base,
      sqft: 1000,
      state: "OH",
      price: 300000,
      title: "house",
    });
    expect(a.verdict).toBe("pass");
  });

  it("treats land as zero-repair", () => {
    const a = analyzeHousingDeal({
      ...base,
      property_type: "land",
      sqft: undefined,
      title: "Vacant lot",
    });
    expect(a.repairEstimate).toBe(0);
  });
});
