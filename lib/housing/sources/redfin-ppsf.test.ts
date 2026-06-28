import { describe, it, expect } from "vitest";
import { parseStatePpsf } from "./redfin-ppsf";

// A trimmed sample mirroring Redfin's state_market_tracker schema: quoted text fields, bare numbers,
// `NA` nulls, multiple property types and periods per state. Column order is shuffled vs. the docs to
// prove the parser keys by header name, not fixed index. Type IDs: -1=all, 6=single_family, 3=condo.
const HEADER =
  "PERIOD_END\tREGION_TYPE\tSTATE_CODE\tPROPERTY_TYPE_ID\tMEDIAN_SALE_PRICE\tMEDIAN_PPSF";
const ROWS = [
  // TX: two months of All Residential (newer wins) + single-family + a condo row that's NA.
  '"2026-04-30"\t"state"\t"TX"\t-1\t330000\t195',
  '"2026-05-31"\t"state"\t"TX"\t-1\t340000\t201',
  '"2026-05-31"\t"state"\t"TX"\t6\t360000\t210',
  '"2026-05-31"\t"state"\t"TX"\t3\t300000\tNA',
  // OH: All Residential only.
  '"2026-05-31"\t"state"\t"OH"\t-1\t180000\t142',
  // CA: latest All-Residential PPSF is NA → falls back to the earlier usable month.
  '"2026-04-30"\t"state"\t"CA"\t-1\t800000\t430',
  '"2026-05-31"\t"state"\t"CA"\t-1\t810000\tNA',
  // XX: only an unmodeled property type (99) → state dropped entirely.
  '"2026-05-31"\t"state"\t"XX"\t99\t500000\t500',
];
const SAMPLE = [HEADER, ...ROWS].join("\n") + "\n";

describe("parseStatePpsf", () => {
  const map = parseStatePpsf(SAMPLE);

  it("breaks out $/sqft by property type, latest period each", () => {
    expect(map.TX).toEqual({ all: 201, single_family: 210 });
  });

  it("skips NA values (no condo key for TX)", () => {
    expect(map.TX.condo).toBeUndefined();
  });

  it("keeps the latest usable all-residential month when newer is NA", () => {
    expect(map.CA).toEqual({ all: 430 });
  });

  it("drops states that only have unmodeled property types", () => {
    expect(map.XX).toBeUndefined();
    expect(Object.keys(map).sort()).toEqual(["CA", "OH", "TX"]);
    expect(map.OH).toEqual({ all: 142 });
  });

  it("returns {} for empty or headerless input", () => {
    expect(parseStatePpsf("")).toEqual({});
    expect(parseStatePpsf("just one line")).toEqual({});
  });

  it("returns {} when a required column is absent", () => {
    expect(
      parseStatePpsf('STATE_CODE\tPERIOD_END\n"TX"\t"2026-05-31"'),
    ).toEqual({}); // no MEDIAN_PPSF / PROPERTY_TYPE_ID
  });
});
