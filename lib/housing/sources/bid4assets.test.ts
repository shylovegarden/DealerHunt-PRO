import { describe, it, expect } from "vitest";
import { toProperty, mapType } from "./bid4assets";

const RAW = {
  auctionId: 1292507,
  assetTitle:
    "Texas, Hudspeth County, 0.14 Acre 79 Eastern Hills #2 Lot 9. No Reserve Cash Sale.",
  highBidAmount: 1500,
  bidOpenTime: "2026-06-27T12:15:33",
  bidCloseTime: "2026-06-29T12:15:00",
  thumbnailImageUrl:
    "https://publicresources.bid4assets.com/mainimages/MainImage_1292507.jpg",
  locatedCity: "TX",
  locatedState: "Sierra Blanca",
};

describe("mapType", () => {
  it("detects land", () => {
    expect(mapType("0.14 Acre Lot")).toBe("land");
  });
  it("defaults to single_family", () => {
    expect(mapType("123 Main St residential home")).toBe("single_family");
  });
});

describe("toProperty", () => {
  it("maps a Bid4Assets listing to Property (swapping city/state as B4A does)", () => {
    const p = toProperty(RAW)!;
    expect(p).not.toBeNull();
    expect(p.source).toBe("bid4assets");
    expect(p.source_listing_id).toBe("1292507");
    expect(p.property_type).toBe("land");
    expect(p.price).toBe(1500);
    expect(p.state).toBe("TX");
    expect(p.city).toBe("Sierra Blanca");
    expect(p.seller_type).toBe("gov");
    expect(p.images).toEqual([
      "https://publicresources.bid4assets.com/mainimages/MainImage_1292507.jpg",
    ]);
  });

  it("filters out non-real-estate assets (e.g. cars, bonds, collectibles)", () => {
    const nonRE = {
      auctionId: 55555,
      assetTitle: "2018 Ford Explorer Police Interceptor",
      currentBid: 5000,
    };
    expect(toProperty(nonRE)).toBeNull();
  });
});
