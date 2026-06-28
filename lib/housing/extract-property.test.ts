import { describe, it, expect } from "vitest";
import {
  readProperty,
  extractPropertiesFromJsonLd,
  extractPropertiesFromNextData,
  genericExtractProperties,
} from "./extract-property";

describe("readProperty — shape-agnostic housing read", () => {
  it("reads a schema.org RealEstateListing with nested address + offers", () => {
    const p = readProperty({
      "@type": "SingleFamilyResidence",
      name: "123 Main St, Canton, IL",
      address: {
        streetAddress: "123 Main St",
        addressLocality: "Canton",
        addressRegion: "IL",
        postalCode: "61520",
      },
      numberOfBedrooms: 3,
      numberOfBathroomsTotal: 2,
      floorSize: { value: 1450 },
      offers: { price: "89000" },
    })!;
    expect(p.address).toBe("123 Main St");
    expect(p.city).toBe("Canton");
    expect(p.state).toBe("IL");
    expect(p.price).toBe(89000);
    expect(p.beds).toBe(3);
    expect(p.sqft).toBe(1450);
    expect(p.property_type).toBe("single_family");
  });

  it("rejects objects with no place or no home signal", () => {
    expect(readProperty({ name: "A blog post about homes" })).toBeNull();
    expect(readProperty({ address: { streetAddress: "1 X St" } })).toBeNull(); // place but no price/beds/sqft
  });
});

describe("extractPropertiesFromJsonLd", () => {
  it("reads listings from a schema.org block", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "RealEstateListing",
      name: "Investor Special — Vacant Lot",
      address: {
        addressLocality: "Poinciana",
        addressRegion: "FL",
        postalCode: "34759",
      },
      offers: { price: 12000 },
    })}</script>`;
    const [p] = extractPropertiesFromJsonLd(html);
    expect(p.city).toBe("Poinciana");
    expect(p.state).toBe("FL");
    expect(p.price).toBe(12000);
  });
});

describe("extractPropertiesFromNextData", () => {
  it("walks __NEXT_DATA__ for property-shaped objects (Zillow/Redfin pattern)", () => {
    const next = {
      props: {
        pageProps: {
          searchResults: [
            {
              streetAddress: "55 Oak Ave",
              city: "Akron",
              state: "OH",
              price: 145000,
              beds: 4,
              baths: 2,
              livingArea: 1800,
              homeType: "SINGLE_FAMILY",
            },
            { headline: "not a house" },
          ],
        },
      },
    };
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(next)}</script>`;
    const ps = extractPropertiesFromNextData(html);
    expect(ps).toHaveLength(1);
    expect(ps[0].city).toBe("Akron");
    expect(ps[0].beds).toBe(4);
    expect(ps[0].property_type).toBe("single_family");
  });
});

describe("genericExtractProperties — any housing page, tagged source", () => {
  it("tags the source and dedupes across both islands", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "House",
      name: "9 Elm",
      address: {
        streetAddress: "9 Elm",
        addressLocality: "Tampa",
        addressRegion: "FL",
      },
      offers: { price: 220000 },
    })}</script>`;
    const ps = genericExtractProperties(html, "zillow");
    expect(ps).toHaveLength(1);
    expect(ps[0].source).toBe("zillow");
    expect(ps[0].price).toBe(220000);
  });
});
