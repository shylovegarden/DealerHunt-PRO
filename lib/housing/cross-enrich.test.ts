import { describe, it, expect } from "vitest";
import { crossEnrich } from "./store";
import type { Property } from "./types";

const at = (over: Partial<Property>): Property => ({
  source: "x",
  title: "t",
  address: "123 Main St",
  city: "Atlanta",
  state: "GA",
  zip: "30303",
  ...over,
});

describe("crossEnrich", () => {
  it("lends MLS sqft/beds to a distress lead at the same address", () => {
    const mls = at({
      source: "redfin",
      sqft: 1500,
      beds: 3,
      baths: 2,
      year_built: 1950,
    });
    const distress = at({
      source: "tax_delinquent",
      signals: { tax_delinquent: true },
    });
    const n = crossEnrich([mls, distress]);
    expect(n).toBeGreaterThan(0);
    expect(distress.sqft).toBe(1500); // borrowed → now flip-analyzable
    expect(distress.beds).toBe(3);
    expect((distress.signals as any).cross_enriched).toBe(true);
    // the MLS row is untouched where it already had data
    expect(mls.sqft).toBe(1500);
  });

  it("does not overwrite fields a row already has", () => {
    const a = at({ source: "redfin", sqft: 1500 });
    const b = at({ source: "hud", sqft: 1800 });
    crossEnrich([a, b]);
    expect(a.sqft).toBe(1500);
    expect(b.sqft).toBe(1800);
  });

  it("does not give a land lead a building's sqft", () => {
    const house = at({ source: "redfin", sqft: 1500, beds: 3 });
    const land = at({ source: "land_bank", property_type: "land" });
    crossEnrich([house, land]);
    expect(land.sqft).toBeUndefined();
  });

  it("leaves lone addresses alone", () => {
    const solo = at({ source: "redfin" });
    expect(crossEnrich([solo])).toBe(0);
  });

  it("shares coordinates so a geo-less distress row gets a pin", () => {
    const mls = at({ source: "redfin", lat: 33.74, lng: -84.39 });
    const distress = at({ source: "code_violation" });
    crossEnrich([mls, distress]);
    expect(distress.lat).toBeCloseTo(33.74, 2);
    expect(distress.lng).toBeCloseTo(-84.39, 2);
  });
});
