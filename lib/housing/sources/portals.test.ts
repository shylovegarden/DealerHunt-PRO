import { describe, it, expect } from "vitest";
import { parsePortalHtml } from "./portals";

// Zillow/Realtor/Homes all embed schema.org listings; one JSON-LD sample exercises the shared parse path.
const HTML = `<html><head>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SingleFamilyResidence",
  name: "742 Evergreen Ter, Springfield, MO 65801",
  url: "https://www.zillow.com/homedetails/742-Evergreen-Ter/123_zpid/",
  address: {
    "@type": "PostalAddress",
    streetAddress: "742 Evergreen Ter",
    addressLocality: "Springfield",
    addressRegion: "MO",
    postalCode: "65801",
  },
  numberOfBedrooms: 3,
  floorSize: { "@type": "QuantitativeValue", value: 1680 },
  offers: { "@type": "Offer", price: "189000", priceCurrency: "USD" },
})}</script></head><body></body></html>`;

describe("parsePortalHtml", () => {
  it("parses schema.org listings and stamps a source-prefixed id", () => {
    const props = parsePortalHtml(HTML, "zillow");
    expect(props.length).toBe(1);
    const p = props[0];
    expect(p.source).toBe("zillow");
    expect(p.source_listing_id?.startsWith("zillow-")).toBe(true);
    expect(p.state).toBe("MO");
    expect(p.price).toBe(189000);
  });

  it("uses the same parser for any portal key (realtor)", () => {
    const props = parsePortalHtml(HTML, "realtor");
    expect(props[0].source).toBe("realtor");
    expect(props[0].source_listing_id?.startsWith("realtor-")).toBe(true);
  });

  it("returns [] for a page with no listings", () => {
    expect(
      parsePortalHtml("<html><body>nothing</body></html>", "homes"),
    ).toEqual([]);
  });
});
