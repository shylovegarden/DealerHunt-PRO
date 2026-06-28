import { describe, it, expect } from "vitest";
import { parseRedfinHtml } from "./redfin";

// Redfin embeds listings as schema.org SingleFamilyResidence JSON-LD (per Antigravity's capture).
const REDFIN_HTML = `<html><head>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SingleFamilyResidence",
  name: "1424 Maple Ave, Dallas, TX 75215",
  url: "https://www.redfin.com/TX/Dallas/1424-Maple-Ave-75215/home/12345",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1424 Maple Ave",
    addressLocality: "Dallas",
    addressRegion: "TX",
    postalCode: "75215",
  },
  numberOfBedrooms: 3,
  numberOfBathroomsTotal: 2,
  floorSize: { "@type": "QuantitativeValue", value: 1620 },
  offers: { "@type": "Offer", price: "265000", priceCurrency: "USD" },
})}</script>
</head><body></body></html>`;

describe("parseRedfinHtml", () => {
  it("maps Redfin's schema.org listings to Properties with a stable id", () => {
    const props = parseRedfinHtml(REDFIN_HTML);
    expect(props).toHaveLength(1);
    const p = props[0];
    expect(p.source).toBe("redfin");
    expect(p.source_listing_id).toMatch(/^redfin-/);
    expect(p.address).toBe("1424 Maple Ave");
    expect(p.city).toBe("Dallas");
    expect(p.state).toBe("TX");
    expect(p.price).toBe(265000);
    expect(p.beds).toBe(3);
    expect(p.sqft).toBe(1620); // <-- fires the deal-analyzer's MAO
  });

  it("is stable: same listing → same id (dedupes across runs)", () => {
    const a = parseRedfinHtml(REDFIN_HTML)[0];
    const b = parseRedfinHtml(REDFIN_HTML)[0];
    expect(a.source_listing_id).toBe(b.source_listing_id);
  });

  it("returns [] for a page with no listings", () => {
    expect(parseRedfinHtml("<html><body>no data</body></html>")).toEqual([]);
  });
});
