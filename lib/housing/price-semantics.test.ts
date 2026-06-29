import { describe, it, expect } from "vitest";
import { housingPriceTerms } from "./price-semantics";

describe("housingPriceTerms", () => {
  it("treats government/surplus sources as auctions (starting bid)", () => {
    for (const s of [
      "gov_auction",
      "gsa_realestate",
      "publicsurplus",
      "municibid",
    ]) {
      const t = housingPriceTerms(s);
      expect(t.isAuction).toBe(true);
      expect(t.priceLabel).toBe("Starting bid");
    }
  });

  it("labels HUD as a list price (bid process, but list-priced)", () => {
    expect(housingPriceTerms("hud")).toMatchObject({
      priceLabel: "List price",
      isAuction: false,
    });
  });

  it("labels land banks as a set price", () => {
    expect(housingPriceTerms("land_bank").priceLabel).toBe("Price");
  });

  it("falls back to Asking for ordinary listings", () => {
    expect(housingPriceTerms("redfin")).toMatchObject({
      priceLabel: "Asking",
      kind: "asking",
    });
  });

  it("uses an auction deadline as a fallback signal", () => {
    expect(housingPriceTerms("somethingnew", true).isAuction).toBe(true);
    expect(housingPriceTerms("somethingnew", false).isAuction).toBe(false);
  });
});
