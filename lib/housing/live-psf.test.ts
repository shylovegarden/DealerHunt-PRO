import { describe, it, expect } from "vitest";
import { aggregateSoldPsf, aggregateMarketTemp } from "./live-psf";
import type { Property } from "./types";

const sold = (
  zip: string,
  ppsf: number,
  type?: Property["property_type"],
): Property => ({
  source: "redfin_sold",
  title: "sold",
  zip,
  property_type: type,
  signals: { sold: true, price_per_sqft: ppsf },
});

describe("aggregateSoldPsf", () => {
  it("writes a per-ZIP median only when ≥4 comps exist", () => {
    const rows = aggregateSoldPsf([
      sold("30303", 200),
      sold("30303", 220),
      sold("30303", 240),
      sold("30303", 260),
      sold("99999", 100), // only 1 comp → dropped
    ]);
    const z = rows.find((r) => r.zip === "30303")!;
    expect(z).toBeTruthy();
    expect(z.psf_all).toBe(230); // median of 200,220,240,260
    expect(z.sold_comps).toBe(4);
    expect(rows.find((r) => r.zip === "99999")).toBeUndefined();
  });

  it("breaks out by property type when ≥3 of a type", () => {
    const rows = aggregateSoldPsf([
      sold("30303", 200, "single_family"),
      sold("30303", 220, "single_family"),
      sold("30303", 240, "single_family"),
      sold("30303", 500, "condo"),
    ]);
    const z = rows.find((r) => r.zip === "30303")!;
    expect(z.psf_single_family).toBe(220);
    expect(z.psf_condo).toBeUndefined(); // only 1 condo
  });

  it("rejects junk $/sqft (0, absurd)", () => {
    const rows = aggregateSoldPsf([
      sold("30303", 0),
      sold("30303", 99999),
      sold("30303", 200),
      sold("30303", 210),
      sold("30303", 220),
      sold("30303", 230),
    ]);
    expect(rows[0].sold_comps).toBe(4); // the 0 and 99999 dropped
  });
});

describe("aggregateMarketTemp", () => {
  it("computes active count, median DOM, median asking $/sqft per ZIP", () => {
    const a = (dom: number, ppsf: number): Property => ({
      source: "redfin",
      title: "active",
      zip: "30303",
      signals: { days_on_market: dom, price_per_sqft: ppsf },
    });
    const rows = aggregateMarketTemp([a(10, 200), a(30, 220), a(50, 240)]);
    const z = rows[0];
    expect(z.active_count).toBe(3);
    expect(z.median_dom).toBe(30);
    expect(z.list_psf).toBe(220);
  });

  it("ignores non-MLS sources", () => {
    const rows = aggregateMarketTemp([
      { source: "tax_delinquent", title: "x", zip: "30303" } as Property,
    ]);
    expect(rows).toHaveLength(0);
  });
});
