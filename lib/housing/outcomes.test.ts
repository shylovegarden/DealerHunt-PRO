import { describe, it, expect } from "vitest";
import {
  extractOutcomeRow,
  summarizeOutcomes,
  calibrationFromOutcomes,
  type OutcomeSummary,
  type SavedLead,
} from "./outcomes";

const lead = (status: string, snap: any): SavedLead => ({
  status,
  snapshot: snap,
});

describe("extractOutcomeRow", () => {
  it("pulls features + label from a closed (won) lead with recorded profit", () => {
    const r = extractOutcomeRow(
      lead("closed", {
        lead_score: 82,
        lead_tier: "hot",
        verdict: "strong",
        source: "tax_delinquent",
        price: 40000,
        arv: 120000,
        mao: 54000,
        outcome: { actualProfit: 28500 },
      }),
    )!;
    expect(r.won).toBe(true);
    expect(r.resolved).toBe(true);
    expect(r.leadScore).toBe(82);
    expect(r.actualProfit).toBe(28500);
  });

  it("marks dead leads as lost, open leads as unresolved", () => {
    expect(
      extractOutcomeRow(lead("dead", { lead_tier: "warm" }))!,
    ).toMatchObject({ lost: true, won: false, resolved: true });
    expect(extractOutcomeRow(lead("new", { lead_tier: "hot" }))!).toMatchObject(
      {
        resolved: false,
      },
    );
  });

  it("returns null without a snapshot", () => {
    expect(extractOutcomeRow({ status: "closed", snapshot: null })).toBeNull();
  });
});

describe("summarizeOutcomes", () => {
  it("computes win rate, avg profit, per-tier calibration, and the train gate", () => {
    const rows = [
      extractOutcomeRow(
        lead("closed", { lead_tier: "hot", outcome: { actualProfit: 20000 } }),
      )!,
      extractOutcomeRow(
        lead("closed", { lead_tier: "hot", outcome: { actualProfit: 10000 } }),
      )!,
      extractOutcomeRow(lead("dead", { lead_tier: "warm" }))!,
      extractOutcomeRow(lead("new", { lead_tier: "hot" }))!, // unresolved
    ];
    const s = summarizeOutcomes(rows);
    expect(s.total).toBe(4);
    expect(s.resolved).toBe(3);
    expect(s.won).toBe(2);
    expect(s.lost).toBe(1);
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.avgProfit).toBe(15000);
    expect(s.winRateByTier.hot).toEqual({ won: 2, resolved: 2 });
    expect(s.readyToTrain).toBe(false); // < 50 resolved
  });
});

describe("calibrationFromOutcomes", () => {
  // Build a summary with N resolved rows split across tiers at given win rates.
  const make = (
    tiers: Record<string, { won: number; resolved: number }>,
  ): OutcomeSummary => {
    const resolved = Object.values(tiers).reduce((a, t) => a + t.resolved, 0);
    const won = Object.values(tiers).reduce((a, t) => a + t.won, 0);
    return {
      total: resolved,
      resolved,
      won,
      lost: resolved - won,
      winRate: resolved ? won / resolved : null,
      avgProfit: null,
      winRateByTier: tiers,
      readyToTrain: resolved >= 50,
    };
  };

  it("returns null until there's enough resolved data (no learning on a guess)", () => {
    expect(
      calibrationFromOutcomes(make({ hot: { won: 5, resolved: 8 } })),
    ).toBeNull(); // only 8 resolved
  });

  it("nudges a tier up when it wins more than average, down when less — clamped to ±15%", () => {
    // 60 resolved overall; hot wins 90% (way above the 50% overall), standard wins 10%.
    const cal = calibrationFromOutcomes(
      make({
        hot: { won: 27, resolved: 30 }, // 90%
        standard: { won: 3, resolved: 30 }, // 10%
      }),
    )!;
    expect(cal.basis).toBe(60);
    expect(cal.byTier.hot).toBeCloseTo(1.15); // clamped up
    expect(cal.byTier.standard).toBeCloseTo(0.85); // clamped down
  });

  it("keeps a factor of exactly 1 for a tier with too few real resolutions", () => {
    const cal = calibrationFromOutcomes(
      make({
        hot: { won: 30, resolved: 50 },
        warm: { won: 2, resolved: 4 }, // < MIN_TIER_RESOLVED
      }),
    )!;
    expect(cal.byTier.warm).toBe(1);
  });
});
