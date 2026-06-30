import { describe, it, expect } from "vitest";
import {
  analyzeHousingDeal,
  inferRehabLevel,
  flipVerdict,
} from "./deal-analyzer";
import { marketPsf } from "./arv-psf";
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
  it("computes ARV from an injected $/sqft, repairs, and MAO", () => {
    // Inject psf 180 for deterministic math: ARV 270k; heavy repairs 1500×60 = 90k → MAO = 99k.
    const a = analyzeHousingDeal(
      { ...base, sqft: 1500, state: "IL", price: 60000, title: "fixer" },
      { psf: 180 },
    );
    expect(a.arv).toBe(270000);
    expect(a.repairEstimate).toBe(90000);
    expect(a.mao).toBe(99000);
    expect(a.arvBasis).toBe("market_psf");
    expect(a.arvConfidence).toBe("medium");
    // ask 60k <= mao*0.85 (84.15k) → strong.
    expect(a.verdict).toBe("strong");
  });

  it("uses the real Redfin median sale $/sqft — STATEWIDE = low confidence (no zip→county)", () => {
    // No zip → statewide median: real data but coarse, so confidence is LOW (can't be a verified flip).
    const psf = marketPsf("IL", "single_family");
    expect(psf).toBeGreaterThan(0); // snapshot ships with all 50 states + DC
    const a = analyzeHousingDeal({ ...base, sqft: 1500, state: "IL" });
    expect(a.arvBasis).toBe("market_psf");
    expect(a.arvConfidence).toBe("low");
    expect(a.arv).toBe(1500 * (psf as number));
  });

  it("a ZIP-level median is comp-grade (high confidence, treated as comps)", () => {
    // 60601 → downtown Chicago, present in the ZIP snapshot → tightest free comp → high confidence.
    const a = analyzeHousingDeal({
      ...base,
      sqft: 1500,
      state: "IL",
      zip: "60601",
    });
    expect(a.arvBasis).toBe("comps");
    expect(a.arvConfidence).toBe("high");
    expect(a.arv).toBeGreaterThan(0);
  });

  it("falls back to the coarse regional reference for an unmapped region (low confidence)", () => {
    // "ZZ" is in neither the Redfin snapshot nor STATE_PSF → national $200/sqft fallback.
    const a = analyzeHousingDeal({ ...base, sqft: 1000, state: "ZZ" });
    expect(a.arvBasis).toBe("regional_psf");
    expect(a.arvConfidence).toBe("low");
    expect(a.arv).toBe(200000);
  });

  it("never calls a negative-equity overpay 'tight' (a gut job that loses money is a pass)", () => {
    // ARV 200k, gut repairs (1500 sqft × $90 = 135k), ask 150k → equity = 200-150-135 = −85k. Old code
    // called this 'tight' (ask ≤ 0.75·ARV) and hid the loss; it must be 'pass'.
    const a = analyzeHousingDeal(
      { ...base, title: "gut shell, full rehab", sqft: 1500, price: 150000 },
      { arv: 200000, rehabLevel: "gut" },
    );
    expect(a.equitySpread).toBeLessThan(0);
    expect(a.verdict).toBe("pass");
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

  it("exposes the basis behind every dollar (psf, source, repair psf) for disclosure", () => {
    const a = analyzeHousingDeal(
      { ...base, sqft: 1500, state: "IL", title: "fixer" },
      { psf: 180 },
    );
    expect(a.arvPsf).toBe(180);
    expect(a.repairPsf).toBe(60); // heavy = $60/sqft
    expect(a.arvSource).toBe("snapshot"); // injected psf is treated as committed-grade
  });

  it("regional fallback is sourced 'regional' (no comps) so the UI can label it an estimate", () => {
    const a = analyzeHousingDeal({ ...base, sqft: 1000, state: "ZZ" });
    expect(a.arvSource).toBe("regional");
    expect(a.arvComps).toBeNull();
    expect(a.arvConfidence).toBe("low");
  });
});

describe("flipVerdict", () => {
  it("caps a low-confidence ARV at 'tight' — never a confident strong/fair", () => {
    // ask well under MAO would be "strong", but a coarse ARV can't earn it.
    expect(flipVerdict(50_000, 300_000, 100_000, 150_000, "low")).toBe("tight");
    expect(flipVerdict(50_000, 300_000, 100_000, 150_000, "high")).toBe(
      "strong",
    );
  });

  it("a money-losing gut job is a pass, not 'tight'", () => {
    // ARV 200k, ask 150k, equity −85k → pass even though ask ≤ 0.75·ARV.
    expect(flipVerdict(150_000, 200_000, 5_000, -85_000, "high")).toBe("pass");
  });
});
