import { describe, it, expect } from "vitest";
import { maestroAssetToProperty } from "./govdeals-property";

const ASSET = {
  accountId: 5001,
  assetId: 42,
  assetShortDescription: "Deeply Discounted Single Family House in Canton, IL",
  categoryDescription: "Single Family Property - Residential",
  currentBid: 89000,
  bidCount: 4,
  locationAddress1: "123 Main St",
  locationCity: "Canton",
  locationState: "IL",
  locationZip: "61520",
  country: "USA",
  companyName: "Canton Disposal",
  assetAuctionEndDateUtc: "2026-07-15T17:00:00Z",
  photo: "5001_42_abc.jpg?cb=1",
  isSoldAuction: false,
};

describe("maestroAssetToProperty", () => {
  it("maps a real-estate asset to a HomeIQ Property", () => {
    const p = maestroAssetToProperty(ASSET)!;
    expect(p.source).toBe("gov_auction");
    expect(p.source_listing_id).toBe("gdre-42-5001");
    expect(p.property_type).toBe("single_family");
    expect(p.address).toBe("123 Main St");
    expect(p.city).toBe("Canton");
    expect(p.state).toBe("IL");
    expect(p.price).toBe(89000);
    expect(p.seller_type).toBe("gov");
    expect(p.images?.[0]).toContain("webassets.lqdt1.com");
  });

  it("classifies land + multi-family", () => {
    expect(
      maestroAssetToProperty({
        ...ASSET,
        categoryDescription: "Vacant Land - Residential",
      })!.property_type,
    ).toBe("land");
    expect(
      maestroAssetToProperty({
        ...ASSET,
        categoryDescription: "Multi Family Property - Residential",
      })!.property_type,
    ).toBe("multi_family");
  });

  it("drops sold lots and non-US", () => {
    expect(
      maestroAssetToProperty({ ...ASSET, isSoldAuction: true }),
    ).toBeNull();
    expect(
      maestroAssetToProperty({
        ...ASSET,
        country: "DO",
        locationState: "DO-11",
      }),
    ).toBeNull();
  });
});
