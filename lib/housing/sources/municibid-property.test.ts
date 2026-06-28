import { describe, it, expect } from "vitest";
import { parseMunicibidProperties } from "./municibid-property";

// Fixture mirrors the live Municibid Real-Estate browse card (C169135): each card's data-listingid appears
// twice, a /Listing/Details slug, "CURRENT BID: $ ...", "City, ST | Agency", "BIDS:", "Ended:", and a
// storagemunicibid image. Two cards (a tax parcel + a township house) to exercise dedup + classify.
const FIXTURE = `
<div class="row browse-item" data-listingid="63281618">
  <a href="/Listing/Details/63281618/S-Woodland-Circle-Gibsonia-PA-15044-Tax-Parcel-ID-1504L362">link</a>
  <img src="https://storagemunicibidpro.blob.core.windows.net/assets/media/abc_thumbcrop.jpg" />
  <h1>S. Woodland Circle, Gibsonia, PA 15044 (Tax Parcel ID 1504-L-362)</h1>
  <span>Gibsonia, PA | Richland Township Property and Administration Department BIDS: 0 CURRENT BID: $ 60,000.00 Ended: 7/9/2026 10:00:00 AM</span>
</div>
<div class="row browse-item" data-listingid="63281618">duplicate chunk, no bid</div>
<div class="row browse-item" data-listingid="70001234">
  <a href="/Listing/Details/70001234/123-Main-St-House-Springfield-IL-62704">link</a>
  <span>Springfield, IL | City of Springfield BIDS: 3 CURRENT BID: $ 18,500.00 Ends: 8/1/2026 9:00:00 AM</span>
</div>
`;

describe("parseMunicibidProperties", () => {
  const rows = parseMunicibidProperties(FIXTURE);

  it("extracts both real-estate cards and dedupes the repeated id", () => {
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.source_listing_id)).toEqual([
      "mbre-63281618",
      "mbre-70001234",
    ]);
  });

  it("maps the tax-parcel card to a Property with location, price, and agency", () => {
    const p = rows[0];
    expect(p.source).toBe("gov_auction");
    expect(p.city).toBe("Gibsonia");
    expect(p.state).toBe("PA");
    expect(p.zip).toBe("15044");
    expect(p.price).toBe(60000);
    expect(p.property_type).toBe("land");
    expect(p.seller_type).toBe("gov");
    expect(p.seller).toContain("Richland Township");
    expect(p.bid_count).toBe(0);
    expect(p.auction_end).toBe("2026-07-09T15:00:00.000Z");
    expect(p.images?.[0]).toContain("storagemunicibid");
    expect(p.source_url).toBe("https://municibid.com/Listing/Details/63281618");
  });

  it("classifies a house card as single_family and reads its bids", () => {
    const p = rows[1];
    expect(p.city).toBe("Springfield");
    expect(p.state).toBe("IL");
    expect(p.price).toBe(18500);
    expect(p.property_type).toBe("single_family");
    expect(p.bid_count).toBe(3);
  });

  it("is vertical-isolated — never reads vehicle fields onto a Property", () => {
    for (const p of rows) {
      expect(p).not.toHaveProperty("make");
      expect(p).not.toHaveProperty("model");
      expect(p).not.toHaveProperty("year");
      expect(p.address).toBeTruthy(); // every row is a place, not a car
    }
  });

  it("skips cards with no live bid value", () => {
    const noBid = `<div data-listingid="999"><a href="/Listing/Details/999/Some-Lot-OH">x</a><span>Dayton, OH | County BIDS: 0</span></div>`;
    expect(parseMunicibidProperties(noBid)).toHaveLength(0);
  });
});
