import { describe, it, expect } from "vitest";
import { mapHudListing, parseHudListings } from "./hud-homes";

const RAW = {
  propertyCaseNumber: "512-510068",
  propertyAddress: "2206 Spanish Forest Ln",
  propertyCity: "Richmond",
  propertyState: "TX",
  propertyZip: "77406",
  listPrice: "561200",
  bedrooms: "5",
  bathroomsdecimal: 3.1,
  squareFootage: "4482",
  yearBuilt: "1995",
  propertyStatus: "Price Reduced",
  propertyType: "Single Family Home",
  latitude: "29.6375",
  longitude: "-95.7414",
  propertyThumb: "https://res.cloudinary.com/yardi/.../Front_73676887.png",
  bidOpenDate: "06/29/2026",
};

describe("mapHudListing", () => {
  it("maps a HUD listing to a rich Property", () => {
    const p = mapHudListing(RAW)!;
    expect(p.source).toBe("hud");
    expect(p.source_listing_id).toBe("hud-512-510068");
    expect(p.property_type).toBe("single_family");
    expect(p.price).toBe(561200);
    expect(p.beds).toBe(5);
    expect(p.baths).toBe(3.1);
    expect(p.sqft).toBe(4482); // <-- fires the deal-analyzer's MAO
    expect(p.year_built).toBe(1995);
    expect(p.lat).toBeCloseTo(29.6375, 3);
    expect(p.state).toBe("TX");
    expect(p.seller_type).toBe("gov");
    expect(p.description).toMatch(/Price Reduced/);
    expect(p.auction_end).toBeTruthy();
  });

  it("rejects rows with no case number or price", () => {
    expect(mapHudListing({ ...RAW, propertyCaseNumber: undefined })).toBeNull();
    expect(mapHudListing({ ...RAW, listPrice: "0" })).toBeNull();
  });
});

describe("parseHudListings", () => {
  it("extracts the JSON from the hidden input (entities unescaped)", () => {
    const json = JSON.stringify([RAW]).replace(/"/g, "&quot;");
    const html = `<input type="hidden" id="available_prop" value="${json}" />`;
    const props = parseHudListings(html);
    expect(props).toHaveLength(1);
    expect(props[0].sqft).toBe(4482);
  });

  it("returns [] when the hidden input is absent", () => {
    expect(parseHudListings("<html>no listings</html>")).toEqual([]);
  });
});
