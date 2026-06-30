import { describe, it, expect } from "vitest";
import {
  marketPsf,
  marketPsfDetailed,
  setLiveZipPsf,
  PPSF_UPDATED,
} from "./arv-psf";

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

  it("prefers county-level $/sqft (via zip) over the state median", () => {
    // 90001 → Los Angeles County. LA single-family $/sqft differs from the CA state median.
    const stateSfh = marketPsf("CA", "single_family");
    const countySfh = marketPsf("CA", "single_family", "90001");
    expect(countySfh).toBeGreaterThan(0);
    expect(countySfh).not.toBe(stateSfh);
  });

  it("falls back to state when the zip/county has no data", () => {
    expect(marketPsf("CA", "single_family", "00000")).toBe(
      marketPsf("CA", "single_family"),
    );
  });

  it("returns ZIP-level granularity (tightest comp) for a populated zip", () => {
    // 30303 = downtown Atlanta, present in the committed zip snapshot.
    const d = marketPsfDetailed("GA", "single_family", "30303");
    expect(d).not.toBeNull();
    expect(d!.level).toBe("zip");
    expect(d!.psf).toBeGreaterThan(0);
  });

  it("ZIP tier resolves even without a state code (zip is globally unique)", () => {
    const d = marketPsfDetailed(undefined, "all", "30303");
    expect(d?.level).toBe("zip");
  });

  it("LIVE injected sold $/sqft overrides the static snapshot for that ZIP", () => {
    const before = marketPsfDetailed("GA", "all", "30303")!.psf;
    setLiveZipPsf({ "30303": { all: before + 777 } });
    const after = marketPsfDetailed("GA", "all", "30303")!;
    expect(after.psf).toBe(before + 777);
    expect(after.level).toBe("zip");
    setLiveZipPsf({}); // reset so other tests see the static snapshot
    expect(marketPsfDetailed("GA", "all", "30303")!.psf).toBe(before);
  });
});
