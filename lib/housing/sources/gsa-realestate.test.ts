import { describe, it, expect } from "vitest";
import { parseGsaRealEstate } from "./gsa-realestate";

// Mirrors a realestatesales.gov .itemm card.
const HTML = `
<div class="itemm">
  <a href="/asset-details/?property_id=59"></a>
  <img class="slide-img" src="https://cdn/x.jpg" />
  <div class="property-info">
    <h2>2107 Jackson St - USCG Port Lavaca Housing</h2>
    <h5>2107 Jackson Street  Port Lavaca, TX 77979</h5>
  </div>
  <div class="property-price"><span>$30,000</span></div>
  <div class="covert_auction_date_range_all_listings" data-start-date="2026-05-21T19:00:00Z" data-end-date="2026-07-15T18:00:00Z"></div>
  <ul class="tags"><li><h3>Online Auction</h3></li><li><h3>Residential</h3></li></ul>
</div>
<div class="itemm">
  <a href="/asset-details/?property_id=88"></a>
  <div class="property-info"><h2>40 acres ranch land</h2><h5>County Road 5, Marfa, TX 79843</h5></div>
  <div class="property-price"><span>$120,000</span></div>
  <ul class="tags"><li><h3>Land</h3></li></ul>
</div>`;

describe("parseGsaRealEstate", () => {
  const props = parseGsaRealEstate(HTML);

  it("parses .itemm cards into Properties", () => {
    expect(props).toHaveLength(2);
    const p = props[0];
    expect(p.source).toBe("gsa_realestate");
    expect(p.source_listing_id).toBe("gsare-59");
    expect(p.price).toBe(30000);
    expect(p.state).toBe("TX");
    expect(p.zip).toBe("77979");
    expect(p.city).toBe("Port Lavaca");
    expect(p.property_type).toBe("single_family");
    expect(p.seller_type).toBe("gov");
    expect(p.auction_end).toBe("2026-07-15T18:00:00Z");
    expect(p.images?.[0]).toContain("cdn/x.jpg");
  });

  it("classifies land via tags", () => {
    expect(props[1].property_type).toBe("land");
    expect(props[1].price).toBe(120000);
  });
});
