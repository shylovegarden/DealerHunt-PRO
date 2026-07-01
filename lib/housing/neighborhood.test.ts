import { describe, it, expect, vi } from "vitest";
import { neighborhoodScore } from "./neighborhood";

// The snapshot ships empty (populated by `npm run data:acs`), so we mock the data module (vi.mock is
// hoisted above the import) to exercise the pure scoring logic against known inputs.
vi.mock("./data/zip-acs.json", () => ({
  default: {
    updated: "2026-07-01",
    byZip: {
      "30303": {
        income: 80000,
        pop: 20000,
        vacancyPct: 6,
        incomeGrowthPct: 12,
        popGrowthPct: 8,
        vacancyDeltaPct: -2,
      },
      "44105": {
        income: 28000,
        pop: 15000,
        vacancyPct: 22,
        incomeGrowthPct: -6,
        popGrowthPct: -4,
        vacancyDeltaPct: 3,
      },
      "63101": {
        income: 45000,
        pop: 8000,
        vacancyPct: 12,
        incomeGrowthPct: 1,
        popGrowthPct: 0,
        vacancyDeltaPct: 0,
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
    expect(r.label).toMatch(/Rising.*incomes \+12%/);
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
