import { describe, it, expect } from "vitest";
import { scoreHousingLead, scoreAndRank } from "./lead-score";
import type { Property } from "./types";

const base: Property = {
  source: "gov_auction",
  title: "Single Family House",
  property_type: "single_family",
  price: 150000,
  seller_type: "gov",
};

describe("scoreHousingLead", () => {
  it("scores a deeply-discounted fixer as a HOT lead with reasons", () => {
    const r = scoreHousingLead({
      ...base,
      title:
        "Attention Investors: Deeply Discounted Single Family Rehab Opportunity",
      price: 19900,
      bid_count: 0,
      auction_end: new Date(Date.now() + 12 * 3600_000).toISOString(),
    });
    expect(r.tier).toBe("hot");
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.signals.join(" ")).toMatch(/Motivated|Deep value|No bids|48h/i);
  });

  it("scores a plain full-price house lower (standard/warm)", () => {
    const r = scoreHousingLead({
      ...base,
      title: "Single Family House",
      price: 320000,
      bid_count: 20,
    });
    expect(r.score).toBeLessThan(45);
    expect(r.tier).toBe("standard");
  });

  it("is property-type aware on discount (cheap land isn't a steal)", () => {
    const cheapLand = scoreHousingLead({
      ...base,
      property_type: "land",
      title: "Vacant Lot",
      price: 12000,
    });
    const cheapHouse = scoreHousingLead({
      ...base,
      property_type: "single_family",
      title: "House",
      price: 12000,
    });
    expect(cheapHouse.score).toBeGreaterThan(cheapLand.score);
  });

  it("clamps to 0–100 and always returns a tier", () => {
    const r = scoreHousingLead({
      ...base,
      title: "rehab fixer distressed foreclosure investor as-is motivated",
      price: 9000,
      bid_count: 0,
      auction_end: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(["hot", "warm", "standard"]).toContain(r.tier);
  });
});

describe("equity signal (the math, not just distress words)", () => {
  it("lifts a sqft-rich home priced far below its max offer", () => {
    // No distress language — only the 70%-rule math should make this a lead.
    const underpriced = scoreHousingLead({
      ...base,
      title: "3 bed home",
      property_type: "single_family",
      state: "OH",
      sqft: 2000,
      price: 45000,
    });
    const atArv = scoreHousingLead({
      ...base,
      title: "3 bed home",
      property_type: "single_family",
      state: "OH",
      sqft: 2000,
      price: 300000, // ~ARV → no equity
    });
    expect(underpriced.score).toBeGreaterThan(atArv.score);
    expect(underpriced.signals.join(" ")).toMatch(/below max offer|equity/i);
  });

  it("does nothing when sqft is unknown (no ARV → no equity signal)", () => {
    const r = scoreHousingLead({
      ...base,
      sqft: undefined,
      title: "house",
      price: 10000,
    });
    expect(r.signals.join(" ")).not.toMatch(/equity/i);
  });
});

describe("scoreAndRank", () => {
  it("returns leads hottest-first", () => {
    const ranked = scoreAndRank([
      { ...base, title: "plain house", price: 300000, bid_count: 15 },
      {
        ...base,
        title: "Deeply Discounted Rehab Fixer",
        price: 18000,
        bid_count: 0,
      },
    ]);
    expect(ranked[0].lead.score).toBeGreaterThan(ranked[1].lead.score);
    expect(ranked[0].title).toMatch(/Rehab/);
  });
});
