import { describe, it, expect } from "vitest";
import { parseHomePath } from "./homepath";

// A realistic HomePath listing record (the shape the /cfl/property-inventory/search endpoint returns).
const SAMPLE = {
  propertyUuid: "4adeb92b-07a0-4d11-8aae-3819d61431ae",
  reoId: "D26000V",
  propertyType: "Single Family",
  addressLine1: "9200 Westheimer Rd 203",
  city: "Houston",
  county: "Harris County",
  state: "TX",
  zipCode: "77063-1234",
  price: 185000,
  bedrooms: 2,
  bathrooms: 2,
  sqft: 1340,
  yearBuilt: 2003,
  propertyListingStatus: "RETAIL_LISTING",
  geoPoint: { latitude: 29.739319, longitude: -95.52606 },
  primHiResImageUrl: "https://img/x.jpg",
  occupancyStatusCode: "VACANT",
  tenantOccupied: false,
  firstLookProgramIndicator: true,
};

describe("parseHomePath", () => {
  it("maps a HomePath REO record into a HomeIQ Property", () => {
    const p = parseHomePath(SAMPLE)!;
    expect(p.source).toBe("fannie_homepath");
    expect(p.source_listing_id).toBe("fnma-D26000V");
    expect(p.property_type).toBe("single_family");
    expect(p.state).toBe("TX");
    expect(p.zip).toBe("77063"); // trimmed to 5
    expect(p.price).toBe(185000);
    expect(p.beds).toBe(2);
    expect(p.sqft).toBe(1340);
    expect(p.year_built).toBe(2003);
    expect(p.lat).toBeCloseTo(29.7393, 3);
    expect(p.lng).toBeCloseTo(-95.526, 3);
    expect(p.seller_type).toBe("bank");
  });

  it("flags it REO + First-Look so the scorer treats it as motivated bank-owned", () => {
    const s = parseHomePath(SAMPLE)!.signals as any;
    expect(s.reo).toBe(true);
    expect(s.first_look).toBe(true);
    expect(s.occupancy).toBe("VACANT");
  });

  it("falls back to propertyUuid when reoId is missing", () => {
    const p = parseHomePath({ ...SAMPLE, reoId: undefined })!;
    expect(p.source_listing_id).toBe(`fnma-${SAMPLE.propertyUuid}`);
  });

  it("drops non-Fannie ListHub (MLS) rows — only true REO is kept", () => {
    expect(
      parseHomePath({
        ...SAMPLE,
        listingType: "LISTHUB",
        propertyListingStatus: "LISTHUB",
      }),
    ).toBeNull();
  });

  it("returns null without an id or address", () => {
    expect(parseHomePath({ city: "X" })).toBeNull();
    expect(parseHomePath({ reoId: "k", listingType: "LISTED" })).toBeNull(); // REO but no address
  });
});
