import { describe, it, expect } from "vitest";
import { leadCategories, LEAD_CATEGORIES } from "./categories";

describe("leadCategories", () => {
  it("maps source + signals to friendly quick-lists (multi-membership)", () => {
    const cats = leadCategories({
      source: "tax_delinquent",
      verdict: "strong",
      equity: 80000,
      signals: ["Vacant / unsafe", "Out-of-state owner — absentee"],
    });
    expect(cats).toEqual(
      expect.arrayContaining([
        "flip",
        "high_equity",
        "tax_delinquent",
        "vacant",
        "absentee",
      ]),
    );
  });

  it("classifies REO + land bank by source", () => {
    expect(leadCategories({ source: "hud_reo" })).toContain("reo");
    expect(leadCategories({ source: "land_bank" })).toContain("land_bank");
  });

  it("flags a zombie (foreclosure source + vacant signal)", () => {
    const cats = leadCategories({
      source: "foreclosure",
      signals: ["Vacant / unsafe — carrying cost"],
    });
    expect(cats).toEqual(
      expect.arrayContaining(["preforeclosure", "vacant", "zombie"]),
    );
  });

  it("catches pre-foreclosure from a sheriff-sale signal", () => {
    expect(
      leadCategories({
        signals: ["Sheriff/tax sale scheduled — hard deadline"],
      }),
    ).toContain("preforeclosure");
  });

  it("returns [] for a plain lead", () => {
    expect(leadCategories({ source: "redfin", verdict: "pass" })).toEqual([]);
  });

  it("every category has a unique key + label", () => {
    const keys = LEAD_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(LEAD_CATEGORIES.every((c) => c.label.length > 0)).toBe(true);
  });
});
