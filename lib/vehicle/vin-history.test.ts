import { describe, it, expect } from "vitest";
import { historyFromText, sightingsToHistory } from "./vin-history";

describe("sightingsToHistory (our VIN graph — washed-title catcher)", () => {
  it("flags a VIN seen at a salvage auction even if currently listed clean", () => {
    const h = sightingsToHistory([
      { source: "copart", condition: "repairable", damage_type: "FRONT END" },
      { source: "craigslist", condition: "clean" }, // re-listed clean later
    ]);
    expect(h).not.toBeNull();
    expect(h!.source).toBe("vin-graph");
    expect(h!.titleBrands).toEqual(
      expect.arrayContaining(["Previously at Copart salvage auction"]),
    );
  });

  it("flags a prior rebuilt/branded sighting", () => {
    const h = sightingsToHistory([
      { source: "craigslist", condition: "rebuilt_title" },
    ]);
    expect(h!.titleBrands).toContain("Previously listed rebuilt");
  });

  it("returns null when every sighting is clean", () => {
    expect(
      sightingsToHistory([
        { source: "carvana", condition: "clean" },
        { source: "cars_com", condition: "clean" },
      ]),
    ).toBeNull();
    expect(sightingsToHistory([])).toBeNull();
  });
});

describe("historyFromText (free Tier-1 VIN history)", () => {
  it("flags title brands from listing text + condition", () => {
    const h = historyFromText({
      title: "2015 BMW 328i Rebuilt title runs great",
      condition: "rebuilt_title",
    });
    expect(h.titleBrands).toContain("Rebuilt / reconstructed");
    expect(h.authoritative).toBe(false);
  });

  it("catches the dangerous washed-title / salvage + frame signals", () => {
    const h = historyFromText({
      title: "Clean title!! 2018 F-150 (prior salvage, frame damage)",
    });
    expect(h.titleBrands).toEqual(
      expect.arrayContaining([
        "Prior salvage / branded",
        "Frame / structural damage",
      ]),
    );
  });

  it("captures clean-history claims + owner count", () => {
    const h = historyFromText({
      title: "2019 Honda Accord, clean Carfax, no accidents, 1 owner",
    });
    expect(h.titleBrands).toHaveLength(0);
    expect(h.owners).toBe(1);
    expect(h.cleanClaims).toEqual(
      expect.arrayContaining([
        "Clean title/Carfax claimed",
        "No accidents claimed",
        "1 owner claimed",
      ]),
    );
  });

  it("returns 'none' when nothing is disclosed", () => {
    const h = historyFromText({ title: "2020 Toyota Camry SE" });
    expect(h.source).toBe("none");
    expect(h.titleBrands).toHaveLength(0);
  });
});
