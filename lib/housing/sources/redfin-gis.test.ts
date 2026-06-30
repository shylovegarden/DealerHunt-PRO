import { describe, it, expect } from "vitest";
import {
  parseCsvLine,
  parseRedfinCsv,
  areaToBBox,
  configuredAreas,
} from "./redfin-gis";

// A realistic gis-csv body: Redfin prepends a disclaimer line, then the header, then rows. Includes a
// quoted address with a comma, an active MLS listing, and a PAST SALE comp.
const CSV = [
  '"In accordance with local MLS rules, some MLS listings are not included in the download"',
  "SALE TYPE,SOLD DATE,PROPERTY TYPE,ADDRESS,CITY,STATE OR PROVINCE,ZIP OR POSTAL CODE,PRICE,BEDS,BATHS,LOCATION,SQUARE FEET,LOT SIZE,YEAR BUILT,DAYS ON MARKET,$/SQUARE FEET,HOA/MONTH,STATUS,NEXT OPEN HOUSE START TIME,NEXT OPEN HOUSE END TIME,URL (SEE https://www.redfin.com/buy-a-home/comparative-market-analysis FOR INFO ON PRICING),SOURCE,MLS#,FAVORITE,INTERESTED,LATITUDE,LONGITUDE",
  'MLS Listing,,Condo/Co-op,"1 Scott Cir NW #616",Washington,DC,20036,250000,1,1.0,Dupont Circle,482,,1891,1,519,,Active,,,https://www.redfin.com/DC/Washington/1-Scott-Cir-NW-20036/unit-616/home/9868980,Compass,2131616253735980097,N,Y,38.9078441,-77.0360906',
  "PAST SALE,2026-05-01,Single Family Residential,1931 Cherokee St,Baton Rouge,LA,70806,280000,3,2.0,Mid City,2186,,1940,,128,,Sold,,,https://www.redfin.com/LA/Baton-Rouge/1931-Cherokee-St-70806/home/123,Keller Williams,9988776655,N,N,30.45,-91.18",
].join("\n");

describe("parseCsvLine", () => {
  it("honors quoted fields containing commas", () => {
    expect(parseCsvLine('a,"b, c",d')).toEqual(["a", "b, c", "d"]);
  });
  it("honors escaped double-quotes", () => {
    expect(parseCsvLine('"he said ""hi""",x')).toEqual(['he said "hi"', "x"]);
  });
});

describe("parseRedfinCsv (for-sale)", () => {
  it("parses active MLS listings and skips PAST SALE rows", () => {
    const rows = parseRedfinCsv(CSV);
    expect(rows).toHaveLength(1);
    const p = rows[0];
    expect(p.source).toBe("redfin");
    expect(p.address).toBe("1 Scott Cir NW #616");
    expect(p.city).toBe("Washington");
    expect(p.state).toBe("DC");
    expect(p.zip).toBe("20036");
    expect(p.price).toBe(250000);
    expect(p.beds).toBe(1);
    expect(p.property_type).toBe("condo");
    expect(p.lat).toBeCloseTo(38.9078, 3);
    expect(p.seller_type).toBe("agent");
    expect((p.signals as any).mls).toBe(true);
    expect((p.signals as any).mls_number).toBe("2131616253735980097");
    expect((p.signals as any).brokerage).toBe("Compass");
  });

  it("derives a stable id from the listing URL (dedupes across runs)", () => {
    const a = parseRedfinCsv(CSV)[0];
    const b = parseRedfinCsv(CSV)[0];
    expect(a.source_listing_id).toBe(b.source_listing_id);
    expect(a.source_listing_id).toMatch(/^redfin-/);
  });
});

describe("parseRedfinCsv (sold comps)", () => {
  it("returns only PAST SALE rows when wantSold is set", () => {
    const rows = parseRedfinCsv(CSV, true);
    expect(rows).toHaveLength(1);
    const p = rows[0];
    expect(p.source).toBe("redfin_sold");
    expect(p.price).toBe(280000);
    expect((p.signals as any).sold).toBe(true);
  });
});

describe("areaToBBox", () => {
  it("builds a box centered on the point, wider in lng than lat (cos correction)", () => {
    const b = areaToBBox({ name: "x", lat: 40, lng: -80, radiusMi: 10 });
    expect(b.south).toBeLessThan(40);
    expect(b.north).toBeGreaterThan(40);
    expect(b.east - b.west).toBeGreaterThan(b.north - b.south); // lng span wider at lat 40
  });
});

describe("configuredAreas", () => {
  it("falls back to the built-in metro seed when REDFIN_AREAS is unset", () => {
    const prev = process.env.REDFIN_AREAS;
    delete process.env.REDFIN_AREAS;
    expect(configuredAreas().length).toBeGreaterThan(5);
    if (prev !== undefined) process.env.REDFIN_AREAS = prev;
  });
  it("parses REDFIN_AREAS override", () => {
    const prev = process.env.REDFIN_AREAS;
    process.env.REDFIN_AREAS = "Austin TX|30.27|-97.74|12";
    const a = configuredAreas();
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ name: "Austin TX", lat: 30.27, radiusMi: 12 });
    if (prev !== undefined) process.env.REDFIN_AREAS = prev;
    else delete process.env.REDFIN_AREAS;
  });
});
