import { describe, it, expect, vi } from "vitest";
import { neighborhoodScore } from "./neighborhood";

// The snapshot ships empty (populated by `npm run data:acs`), so we mock the data module (vi.mock is
// hoisted above the import) to exercise the pure scoring logic against known inputs.
// Baseline = national medians; growth is scored RELATIVE to it. 30303 outperforms on every metric,
// 44105 underperforms on every metric, 63101 sits at the baseline.
vi.mock("./data/zip-acs.json", () => ({
  default: {
    updated: "2026-07-01",
    baseline: { incomeGrowthPct: 28, popGrowthPct: 0, vacancyDeltaPct: -1 },
    byZip: {
      "30303": {
        income: 80000,
        pop: 20000,
        vacancyPct: 6,
        incomeGrowthPct: 55, // +27 vs baseline
        popGrowthPct: 15, // +15 vs baseline
        vacancyDeltaPct: -8, // falling faster than baseline
      },
      "44105": {
        income: 28000,
        pop: 15000,
        vacancyPct: 22,
        incomeGrowthPct: 5, // −23 vs baseline (lost to inflation)
        popGrowthPct: -20, // −20 vs baseline
        vacancyDeltaPct: 8, // rising vacancy
      },
      "63101": {
        income: 45000,
        pop: 8000,
        vacancyPct: 12,
        incomeGrowthPct: 28, // at baseline
        popGrowthPct: 0,
        vacancyDeltaPct: -1,
      },
    },
  },
}));

describe("neighborhoodScore", () => {
  it("returns null for a ZIP not in the snapshot (never invents a read)", () => {
    expect(neighborhoodScore("00000")).toBeNull();
    expect(neighborhoodScore(undefined)).toBeNull();
  });

  it("scores a growing ZIP as rising", () => {
    const r = neighborhoodScore("30303")!;
    expect(r.trajectory).toBe("rising");
    expect(r.score).toBeGreaterThan(62);
    expect(r.label).toMatch(/Rising.*incomes \+27% vs avg.*population \+15%/);
    expect(r.income).toBe(80000);
  });

  it("scores a shrinking, high-vacancy ZIP as declining", () => {
    const r = neighborhoodScore("44105")!;
    expect(r.trajectory).toBe("declining");
    expect(r.score).toBeLessThan(42);
  });

  it("scores a flat ZIP as stable", () => {
    expect(neighborhoodScore("63101")!.trajectory).toBe("stable");
  });
});
