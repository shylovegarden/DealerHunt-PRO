import { describe, it, expect } from "vitest";
import {
  median,
  priceBins,
  countBy,
  summarizeMarket,
  type MarketLead,
} from "./market-stats";

describe("median", () => {
  it("returns 0 for an empty list", () => {
    expect(median([])).toBe(0);
  });
  it("returns the middle element for odd-length lists", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the two middle elements for even-length lists", () => {
    expect(median([1, 2, 3, 4])).toBe(3); // (2+3)/2 = 2.5 -> rounded to 3
  });
  it("does not mutate the input", () => {
    const xs = [5, 1, 3];
    median(xs);
    expect(xs).toEqual([5, 1, 3]);
  });
});

describe("priceBins", () => {
  it("returns [] when there are fewer than 4 priced values", () => {
    expect(priceBins([10000, 20000, 30000])).toEqual([]);
  });

  it("ignores non-positive prices", () => {
    expect(priceBins([0, -5, 100])).toEqual([]);
  });

  it("produces the requested number of buckets and counts every value", () => {
    const prices = Array.from({ length: 100 }, (_, i) => (i + 1) * 1000);
    const bins = priceBins(prices);
    expect(bins).toHaveLength(12);
    const counted = bins.reduce((a, b) => a + b.n, 0);
    expect(counted).toBe(prices.length);
  });

  it("buckets contiguously from 0 with a clean $5k-stepped width", () => {
    const prices = Array.from({ length: 50 }, (_, i) => (i + 1) * 2000);
    const bins = priceBins(prices);
    expect(bins[0].from).toBe(0);
    const width = bins[0].to - bins[0].from;
    expect(width % 5000).toBe(0);
    // each bin starts where the previous ended
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i].from).toBe(bins[i - 1].to);
    }
  });

  it("dumps values above the p95 cap into the final bucket (outliers don't add buckets)", () => {
    const prices = [...Array(99).fill(50000), 5_000_000];
    const bins = priceBins(prices);
    expect(bins).toHaveLength(12);
    expect(bins[bins.length - 1].n).toBeGreaterThanOrEqual(1);
    expect(bins.reduce((a, b) => a + b.n, 0)).toBe(prices.length);
  });
});

describe("countBy", () => {
  const leads: MarketLead[] = [
    { tier: "hot", source: "hud", state: "TX" },
    { tier: "warm", source: "hud", state: "" },
    { tier: "standard", source: undefined, state: "OH" },
  ];
  it("counts present values and skips null/empty", () => {
    expect(countBy(leads, "source")).toEqual({ hud: 2 });
    expect(countBy(leads, "state")).toEqual({ TX: 1, OH: 1 });
  });
});

describe("summarizeMarket", () => {
  const leads: MarketLead[] = [
    {
      tier: "hot",
      source: "hud",
      property_type: "single_family",
      state: "TX",
      price: 100000,
      equity: 25000,
      verdict: "strong",
    },
    {
      tier: "hot",
      source: "land_bank",
      property_type: "land",
      state: "TX",
      price: 5000,
      equity: -1000,
      verdict: "pass",
    },
    {
      tier: "warm",
      source: "hud",
      property_type: "single_family",
      state: "OH",
      price: 60000,
      equity: 0,
      verdict: "unknown",
    },
    {
      tier: "standard",
      source: "redfin",
      property_type: "condo",
      state: "OH",
      // no price / equity / verdict
    },
  ];

  const s = summarizeMarket(leads);

  it("counts tiers including states with hot leads", () => {
    expect(s.byTier).toMatchObject({ hot: 2, warm: 1, standard: 1 });
    expect(s.byStateHot).toEqual({ TX: 2 });
  });

  it("excludes the 'unknown' verdict from byVerdict", () => {
    expect(s.byVerdict).toEqual({ strong: 1, pass: 1 });
  });

  it("counts only positive-equity leads as flippable", () => {
    expect(s.flippable).toBe(1);
  });

  it("collects only positive prices and their median", () => {
    expect([...s.priced].sort((a, b) => a - b)).toEqual([5000, 60000, 100000]);
    expect(s.medianPrice).toBe(60000);
  });

  it("aggregates source/type/state facets", () => {
    expect(s.bySource).toEqual({ hud: 2, land_bank: 1, redfin: 1 });
    expect(s.byType).toEqual({ single_family: 2, land: 1, condo: 1 });
    expect(s.byState).toEqual({ TX: 2, OH: 2 });
  });

  it("is pure — same input yields a deeply equal summary", () => {
    expect(summarizeMarket(leads)).toEqual(s);
  });
});
