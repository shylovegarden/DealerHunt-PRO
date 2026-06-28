import { describe, it, expect } from "vitest";
import { parseDetroitLandBank } from "./detroit-landbank";

// Fixture mirrors the real `var listingsdata = {...}` blob embedded in a buildingdetroit.org browse page:
// pagination wrapper + a listings[] of rich rows (lat/lng, area=sqft, beds/baths, minimum_offer, image).
const FIXTURE = `
<!doctype html><html><head>
<script type="text/javascript"> var listingsdata = {"pagination":{"total":"36","per_page":15,"current_page":1,"last_page":3},"listings":[
{"property_name":"4291 Cortland","property_id":"9418442","price":"235000","minimum_offer":"1000","city":"Detroit","district":"District 7","area":"1714","bedrooms":"3","bathrooms":"2","state":"MI","zipcode":"48204","neighbourhood":"Russell Woods","property_identifier":"4291-cortland","latitude":"42.3810734","longitude":"83.1326285","category_type":"List Only","auction_closing_time":null,"file_path":"https://s3.us-east-2.amazonaws.com/dlba-production-bucket/property_images/9418442/front.png","short_description":"","is_wishlist":0},
{"property_name":"100 Vacant Side Lot","property_id":"9400001","price":"5000","minimum_offer":"100","city":"Detroit","area":"0","bedrooms":"0","bathrooms":"0","state":"MI","zipcode":"48202","property_identifier":"100-side-lot","latitude":"42.40","longitude":"83.05","category_type":"List Only","file_path":"","short_description":"Vacant side lot"}
]}; </script></head><body></body></html>`;

describe("parseDetroitLandBank", () => {
  const rows = parseDetroitLandBank(FIXTURE);

  it("extracts listings from the embedded listingsdata blob", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe("land_bank");
    expect(rows[0].source_listing_id).toBe("dlb-9418442");
  });

  it("maps a house with sqft/beds/baths and the cheap entry price", () => {
    const p = rows[0];
    expect(p.city).toBe("Detroit");
    expect(p.state).toBe("MI");
    expect(p.zip).toBe("48204");
    expect(p.sqft).toBe(1714);
    expect(p.beds).toBe(3);
    expect(p.baths).toBe(2);
    expect(p.price).toBe(1000); // minimum_offer, not the 235k list price
    expect(p.property_type).toBe("single_family");
    expect(p.seller).toContain("Detroit Land Bank");
    expect(p.source_url).toBe(
      "https://buildingdetroit.org/property/4291-cortland",
    );
    expect(p.images?.[0]).toContain("dlba-production-bucket");
    expect(p.signals?.list_price).toBe(235000);
  });

  it("forces US longitude negative (Detroit must not plot in the eastern hemisphere)", () => {
    expect(rows[0].lat).toBeCloseTo(42.381, 2);
    expect(rows[0].lng).toBeCloseTo(-83.133, 2);
    expect(rows[0].lng).toBeLessThan(0);
  });

  it("classifies a vacant side lot as land", () => {
    expect(rows[1].property_type).toBe("land");
    expect(rows[1].sqft).toBeUndefined(); // area 0 → not a real sqft
  });

  it("is vertical-isolated — Property fields only, no vehicle fields", () => {
    for (const p of rows) {
      expect(p).not.toHaveProperty("make");
      expect(p).not.toHaveProperty("year");
      expect(p.address).toBeTruthy();
    }
  });

  it("returns [] when no listingsdata blob is present", () => {
    expect(parseDetroitLandBank("<html><body>no data</body></html>")).toEqual(
      [],
    );
  });
});
