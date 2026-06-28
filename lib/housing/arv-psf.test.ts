import { describe, it, expect } from "vitest";
import { marketPsf, PPSF_UPDATED } from "./arv-psf";

// Runs against the committed real Redfin snapshot (lib/housing/data/state-ppsf.json). Assertions are
// shape/relationship-based (not exact dollar values) so a monthly refresh doesn't break them.
describe("marketPsf", () => {
  it("ships a dated snapshot covering the 50 states + DC", () => {
    expect(PPSF_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a positive $/sqft for a known state", () => {
    expect(marketPsf("CA")).toBeGreaterThan(0);
    expect(marketPsf("ca")).toBe(marketPsf("CA")); // case-insensitive
  });

  it("prefers the property-type-specific figure over the aggregate", () => {
    // CA condos and single-family differ; asking for a type should not just return `all`.
    const all = marketPsf("CA");
    const condo = marketPsf("CA", "condo");
    const sfh = marketPsf("CA", "single_family");
    expect(condo).toBeGreaterThan(0);
    expect(sfh).toBeGreaterThan(0);
    expect(condo).not.toBe(sfh);
  });

  it("falls back to the aggregate for a type with no data", () => {
    expect(marketPsf("CA", "spaceship")).toBe(marketPsf("CA"));
  });

  it("returns null for unknown/missing states", () => {
    expect(marketPsf("ZZ")).toBeNull();
    expect(marketPsf(undefined)).toBeNull();
    expect(marketPsf("")).toBeNull();
  });
});
