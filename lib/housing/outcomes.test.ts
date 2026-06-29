import { describe, it, expect } from "vitest";
import {
  extractOutcomeRow,
  summarizeOutcomes,
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
