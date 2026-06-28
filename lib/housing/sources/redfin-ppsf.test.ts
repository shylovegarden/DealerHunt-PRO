import { describe, it, expect } from "vitest";
import { parseStatePpsf } from "./redfin-ppsf";

// A trimmed sample mirroring Redfin's state_market_tracker schema: quoted text fields, bare numbers,
// `NA` nulls, multiple property types and periods per state. Column order is shuffled vs. the docs to
// prove the parser keys by header name, not fixed index.
const HEADER =
  "PERIOD_END\tREGION_TYPE\tSTATE_CODE\tPROPERTY_TYPE_ID\tMEDIAN_SALE_PRICE\tMEDIAN_PPSF";
const ROWS = [
  // TX: two periods of All Residential (-1) — newer should win — plus a single-family (6) row to ignore.
  '"2026-04-30"\t"state"\t"TX"\t-1\t330000\t195',
  '"2026-05-31"\t"state"\t"TX"\t-1\t340000\t201',
  '"2026-05-31"\t"state"\t"TX"\t6\t360000\t210',
  // OH: All Residential with a value.
  '"2026-05-31"\t"state"\t"OH"\t-1\t180000\t142',
  // CA: latest All-Residential PPSF is NA → should fall back to the earlier usable month.
  '"2026-04-30"\t"state"\t"CA"\t-1\t800000\t430',
  '"2026-05-31"\t"state"\t"CA"\t-1\t810000\tNA',
];
const SAMPLE = [HEADER, ...ROWS].join("\n") + "\n";

describe("parseStatePpsf", () => {
  const map = parseStatePpsf(SAMPLE);

  it("takes the most recent period's All-Residential median sale $/sqft", () => {
    expect(map.TX).toBe(201); // 2026-05-31 wins over 2026-04-30
  });

  it("ignores non-aggregate property-type rows", () => {
    expect(map.TX).not.toBe(210); // the single-family (id 6) row
  });

  it("skips NA values and keeps the latest usable month", () => {
    expect(map.CA).toBe(430); // May was NA → April's 430
  });

  it("parses every state present", () => {
    expect(Object.keys(map).sort()).toEqual(["CA", "OH", "TX"]);
    expect(map.OH).toBe(142);
  });

  it("returns {} for empty or headerless input", () => {
    expect(parseStatePpsf("")).toEqual({});
    expect(parseStatePpsf("just one line")).toEqual({});
  });

  it("returns {} when MEDIAN_PPSF column is absent", () => {
    expect(
      parseStatePpsf('STATE_CODE\tPERIOD_END\n"TX"\t"2026-05-31"'),
    ).toEqual({});
  });
});
