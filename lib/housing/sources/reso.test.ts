import { describe, it, expect } from "vitest";
import { parseResoProperty } from "./reso";

// A realistic RESO Data Dictionary `Property` record (the shape MARIS/Bridge/Trestle return).
const SAMPLE = {
  ListingKey: "MLS123456",
  ListingId: "24-1001",
  StandardStatus: "Active",
  PropertyType: "Residential",
  PropertySubType: "SingleFamilyResidence",
  UnparsedAddress: "742 Evergreen Ter, Springfield, MO 65801",
  City: "Springfield",
  StateOrProvince: "MO",
  PostalCode: "65801-1234",
  ListPrice: 189000,
  BedroomsTotal: 3,
  BathroomsTotalInteger: 2,
  LivingArea: 1680,
  YearBuilt: 1998,
  Latitude: 37.21,
  Longitude: -93.29,
  PublicRemarks: "Motivated seller — sold as-is, needs some TLC.",
  ListAgentFullName: "Jane Agent",
  ModificationTimestamp: "2026-06-30T12:00:00Z",
  Media: [
    { MediaURL: "https://cdn/x/2.jpg", Order: 2, MediaCategory: "Photo" },
    { MediaURL: "https://cdn/x/1.jpg", Order: 1, MediaCategory: "Photo" },
  ],
};

describe("parseResoProperty", () => {
  it("maps a RESO Property record into a HomeIQ Property", () => {
    const p = parseResoProperty(SAMPLE)!;
    expect(p.source).toBe("mls");
    expect(p.source_listing_id).toBe("mls-MLS123456");
    expect(p.property_type).toBe("single_family");
    expect(p.state).toBe("MO");
    expect(p.zip).toBe("65801"); // trimmed to 5
    expect(p.price).toBe(189000);
    expect(p.beds).toBe(3);
    expect(p.sqft).toBe(1680);
    expect(p.year_built).toBe(1998);
    expect((p.signals as any).mls).toBe(true);
    expect((p.signals as any).mls_number).toBe("24-1001");
  });

  it("orders photos by Order", () => {
    const p = parseResoProperty(SAMPLE)!;
    expect(p.images).toEqual(["https://cdn/x/1.jpg", "https://cdn/x/2.jpg"]);
  });

  it("carries PublicRemarks into description (so the distress scorer reads MLS wording)", () => {
    const p = parseResoProperty(SAMPLE)!;
    expect(p.description).toMatch(/motivated/i);
  });

  it("returns null without a key or address", () => {
    expect(parseResoProperty({ City: "X" })).toBeNull();
    expect(parseResoProperty({ ListingKey: "k" })).toBeNull(); // no address
  });

  it("maps subtypes", () => {
    expect(
      parseResoProperty({ ...SAMPLE, PropertySubType: "Condominium" })!
        .property_type,
    ).toBe("condo");
    expect(
      parseResoProperty({ ...SAMPLE, PropertySubType: "Duplex" })!
        .property_type,
    ).toBe("multi_family");
  });
});
