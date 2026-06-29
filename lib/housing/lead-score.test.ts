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

describe("listing-signal coverage (price cut + days on market)", () => {
  it("rewards a published price reduction", () => {
    const reduced = scoreHousingLead({
      ...base,
      title: "House",
      price: 90000,
      signals: { status: "Price Reduced" },
    } as any);
    const plain = scoreHousingLead({
      ...base,
      title: "House",
      price: 90000,
    });
    expect(reduced.score).toBeGreaterThan(plain.score);
    expect(reduced.signals.join(" ")).toMatch(/Price reduced/i);
  });

  it("rewards a stale (long days-on-market) listing", () => {
    const old = new Date(Date.now() - 120 * 86_400_000).toISOString();
    const stale = scoreHousingLead({
      ...base,
      title: "House",
      price: 90000,
      created_at: old,
    } as any);
    expect(stale.signals.join(" ")).toMatch(/on market/i);
  });
});

describe("top-grade scoring: keywords, negatives, stacking, grade", () => {
  it("penalizes full-price ('pride of ownership') wording", () => {
    const polished = scoreHousingLead({
      ...base,
      title:
        "Stunning, meticulously maintained turnkey home — pride of ownership",
      price: 95000,
    });
    const neutral = scoreHousingLead({ ...base, title: "Home", price: 95000 });
    expect(polished.score).toBeLessThan(neutral.score);
  });

  it("tiers keywords: financial urgency outscores pure condition wording", () => {
    const financial = scoreHousingLead({
      ...base,
      title: "Motivated seller must sell — foreclosure",
      price: 95000,
    });
    const condition = scoreHousingLead({
      ...base,
      title: "Handyman fixer needs work",
      price: 95000,
    });
    expect(financial.score).toBeGreaterThan(condition.score);
  });

  it("applies a stacking bonus when 3+ independent signal groups fire", () => {
    const stacked = scoreHousingLead({
      ...base,
      title: "Motivated seller — must sell", // kw group
      property_type: "single_family",
      state: "OH",
      sqft: 2000,
      price: 30000, // deep discount (price) + big equity room (equity) → 3 groups
      signals: { status: "Price Reduced" }, // pricecut group → 4
    } as any);
    expect(stacked.signals.join(" ")).toMatch(/Stacked \d+ independent/i);
  });

  it("always returns a letter grade", () => {
    expect(scoreHousingLead({ ...base, title: "x", price: 1 }).grade).toMatch(
      /^[ABC][+-]?$/,
    );
  });
});

describe("money gate (verified verdict overrides distress vibes)", () => {
  it("never lets a verified-OVERPRICED house be HOT, however motivated the wording", () => {
    // sqft known + ask far above ARV → analyzer verdict 'pass'. Loud distress words would otherwise
    // push it to hot; the gate must cap it below hot so a user never chases a money-loser.
    const r = scoreHousingLead({
      ...base,
      title:
        "Deeply discounted distressed fixer rehab investor as-is motivated must sell foreclosure",
      property_type: "single_family",
      state: "OH",
      sqft: 1500,
      price: 500000, // way above any OH ARV → overpriced
      bid_count: 0,
      auction_end: new Date(Date.now() + 12 * 3600_000).toISOString(),
    });
    expect(r.tier).not.toBe("hot");
  });

  it("adds a verified-flip signal for a real strong-equity deal", () => {
    const r = scoreHousingLead({
      ...base,
      title: "3 bed home",
      property_type: "single_family",
      state: "OH",
      sqft: 2000,
      price: 40000,
    });
    expect(r.signals.join(" ")).toMatch(/Verified flip/i);
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
