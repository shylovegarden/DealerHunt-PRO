import { describe, it, expect } from "vitest";
import { flagPriceAnomalies, type AnomalyLead } from "./anomaly";

// 10 single-family in OH clustered at $100/sqft (1000 sqft → $100k), plus one deep outlier at $50/sqft.
const peers = (n: number, ppsf: number, prefix: string): AnomalyLead[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    state: "OH",
    property_type: "single_family",
    sqft: 1000,
    price: ppsf * 1000,
  }));

describe("flagPriceAnomalies", () => {
  it("flags a listing well below its same-type/state $/sqft peers", () => {
    const leads: AnomalyLead[] = [
      ...peers(10, 100, "p"),
      {
        id: "deal",
        state: "OH",
        property_type: "single_family",
        sqft: 1000,
        price: 50_000, // $50/sqft = 50% below the $100 median
      },
    ];
    const flags = flagPriceAnomalies(leads);
    expect(flags.get("deal")?.pctBelow).toBe(50);
    expect(flags.has("p0")).toBe(false); // peers are not anomalies
  });

  it("does not flag when the peer group is too thin", () => {
    const leads: AnomalyLead[] = [
      ...peers(4, 100, "p"),
      {
        id: "deal",
        state: "OH",
        property_type: "single_family",
        sqft: 1000,
        price: 50_000,
      },
    ];
    expect(flagPriceAnomalies(leads).has("deal")).toBe(false);
  });

  it("does not flag a listing only slightly below the median", () => {
    const leads: AnomalyLead[] = [
      ...peers(10, 100, "p"),
      {
        id: "meh",
        state: "OH",
        property_type: "single_family",
        sqft: 1000,
        price: 88_000, // 12% below — under the threshold
      },
    ];
    expect(flagPriceAnomalies(leads).has("meh")).toBe(false);
  });

  it("skips leads without a usable $/sqft", () => {
    const leads: AnomalyLead[] = [
      ...peers(10, 100, "p"),
      {
        id: "nosqft",
        state: "OH",
        property_type: "single_family",
        price: 5000,
      },
    ];
    expect(flagPriceAnomalies(leads).has("nosqft")).toBe(false);
  });
});
