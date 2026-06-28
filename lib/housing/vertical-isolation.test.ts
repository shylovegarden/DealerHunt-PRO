import { describe, it, expect } from "vitest";
import { maestroAssetToProperty } from "./sources/govdeals-property";
import {
  maestroAssetToDeal,
  type MaestroAsset,
} from "../scrapers/sources/lqdt-maestro";

// VERTICAL ISOLATION — cars and houses share the maestro fetch but must NEVER cross into each other's
// table. These tests pin the boundary in BOTH directions so the gate blocks any future regression that
// would let a car become a Property or a house become a car Deal.

const VEHICLE: MaestroAsset = {
  assetId: 1,
  accountId: 2,
  assetCategory: "94A",
  categoryDescription: "Automobiles/Cars",
  assetShortDescription: "2008 Ford F150",
  makebrand: "Ford",
  model: "F150",
  modelYear: "2008",
  currentBid: 4500,
  locationState: "SD",
  country: "USA",
};

const REAL_ESTATE: MaestroAsset = {
  assetId: 3,
  accountId: 4,
  assetCategory: "95B",
  categoryDescription: "Single Family Property - Residential",
  assetShortDescription: "Deeply Discounted Single Family House in Canton, IL",
  currentBid: 19900,
  locationAddress1: "123 Main St",
  locationCity: "Canton",
  locationState: "IL",
  country: "USA",
};

const CAR_OPTS = {
  source: "gov_auction",
  idPrefix: "gd",
  defaultSeller: "GovDeals",
  requireUS: false,
};

describe("vertical isolation: cars never bleed into houses", () => {
  it("a VEHICLE asset is rejected by the property mapper", () => {
    expect(maestroAssetToProperty(VEHICLE)).toBeNull();
  });
  it("a VEHICLE asset still maps to a car Deal (sanity)", () => {
    const d = maestroAssetToDeal(VEHICLE, CAR_OPTS);
    expect(d).not.toBeNull();
    expect(d!.make).toBe("Ford");
  });
});

describe("vertical isolation: houses never bleed into cars", () => {
  it("a REAL-ESTATE asset is rejected by the car mapper (no model year)", () => {
    expect(maestroAssetToDeal(REAL_ESTATE, CAR_OPTS)).toBeNull();
  });
  it("a REAL-ESTATE asset still maps to a Property (sanity)", () => {
    const p = maestroAssetToProperty(REAL_ESTATE);
    expect(p).not.toBeNull();
    expect(p!.property_type).toBe("single_family");
    expect(p!.city).toBe("Canton");
  });
});
