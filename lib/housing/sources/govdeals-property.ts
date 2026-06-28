// lib/housing/sources/govdeals-property.ts
//
// HomeIQ's first source — and proof the AutoVerse engine harvests HOUSES, not just cars. It reuses the
// SAME maestro fetch (lib/scrapers/sources/lqdt-maestro.ts) the GovDeals/AllSurplus vehicle scrapers use;
// only the category codes + the mapper change. GovDeals real-estate is exactly the lead HomeIQ wants:
// "Deeply Discounted Single Family House," "Rehab Opportunity," residential lots — government/foreclosure
// disposal, free, no paid API. Verified live: 95B/95F/959 return real US properties $80k–$700k.

import type { MaestroAsset } from "../../scrapers/sources/lqdt-maestro";
import { fetchMaestroAssets } from "../../scrapers/sources/lqdt-maestro";
import type { Property, PropertyType } from "../types";

// product_category_external_id codes (verified live): residential real estate.
const REAL_ESTATE_CODES = ["95B", "95F", "959"];

const US_STATE = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

function isUS(a: MaestroAsset): boolean {
  const c = (a.country || "").toUpperCase();
  if (c) return c === "USA" || c === "US";
  return US_STATE.has((a.locationState || "").toUpperCase());
}

// VERTICAL ISOLATION GUARD. The maestro fetch is shared with the CAR scrapers, so the property mapper
// must never accept a vehicle even if a category filter ever leaks. Affirmatively require a real-estate
// signal: the asset's category code is one of ours, OR its category text reads like real estate. A
// vehicle (94A/94Q) fails both → it can NEVER become a Property. (Symmetric direction is already safe:
// the car mapper requires a model year, which real-estate lots don't have.)
const REAL_ESTATE_CATEGORY_CODES = new Set(["95B", "95F", "959"]);
function isRealEstate(a: MaestroAsset): boolean {
  if (a.assetCategory && REAL_ESTATE_CATEGORY_CODES.has(a.assetCategory))
    return true;
  return /real estate|residential|single family|multi[- ]?family|vacant land|land parcel|\bacres?\b/i.test(
    a.categoryDescription || "",
  );
}

function propertyTypeFor(a: MaestroAsset): PropertyType {
  const c = (a.categoryDescription || "").toLowerCase();
  if (c.includes("multi")) return "multi_family";
  if (c.includes("land") || c.includes("lot") || c.includes("acre"))
    return "land";
  if (c.includes("single")) return "single_family";
  return "other";
}

const IMAGE_BASE = "https://webassets.lqdt1.com/assets/photos";

/** Map one maestro real-estate asset to a HomeIQ Property. Null for sold / non-US / unusable rows. */
export function maestroAssetToProperty(
  a: MaestroAsset,
  idPrefix = "gd",
): Property | null {
  const { assetId, accountId } = a;
  if (assetId == null || accountId == null) return null;
  if (a.isSoldAuction) return null;
  if (!isRealEstate(a)) return null; // vertical-isolation guard — never let a vehicle become a Property
  if (!isUS(a)) return null;

  const price = Math.round(Number(a.currentBid ?? a.assetBidPrice ?? 0));
  if (!price || price < 1) return null;

  const photoFile = (a.photo || "").split("?")[0].trim();
  const address = [a.locationAddress1, a.locationAddress2]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    source: "gov_auction",
    source_listing_id: `${idPrefix}re-${assetId}-${accountId}`,
    source_url: `https://www.govdeals.com/asset/${assetId}/${accountId}`,
    title: (a.assetShortDescription || "Government real estate").trim(),
    property_type: propertyTypeFor(a),
    address: address || undefined,
    city: a.locationCity?.trim() || undefined,
    state: a.locationState?.trim() || undefined,
    zip: a.locationZip?.trim() || undefined,
    lat: typeof a.latitude === "number" ? a.latitude : undefined,
    lng: typeof a.longitude === "number" ? a.longitude : undefined,
    price,
    images: photoFile ? [`${IMAGE_BASE}/${accountId}/${photoFile}`] : [],
    seller: (
      a.companyName ||
      a.displaySellerName ||
      "GovDeals (gov disposal)"
    ).trim(),
    seller_type: "gov",
    auction_end: a.assetAuctionEndDateUtc || a.assetAuctionEndDate || undefined,
    bid_count: typeof a.bidCount === "number" ? a.bidCount : undefined,
    signals: {
      auction: true,
      channel: "gov_real_estate",
      marketplace: "govdeals",
    },
    scraped_at: new Date().toISOString(),
  };
}

/** Harvest GovDeals (or AllSurplus) residential real estate as HomeIQ Properties.
 *  NOTE: the maestro API combines a multi-code facetsFilter as AND (a lot can't be all three categories
 *  at once → 0 results), so we query each real-estate code SEPARATELY and merge. */
export async function harvestGovDealsProperties(
  businessId = "GD",
  maxPagesPerCode = 4,
): Promise<Property[]> {
  console.log("[HomeIQ:GovDeals] harvesting real estate...");
  const idPrefix = businessId === "AD" ? "as" : "gd";
  const byId = new Map<string, Property>();
  for (const code of REAL_ESTATE_CODES) {
    const assets = await fetchMaestroAssets(businessId, [code], {
      maxPages: maxPagesPerCode,
      label: `HomeIQ:GovDeals:${code}`,
    });
    for (const a of assets) {
      const p = maestroAssetToProperty(a, idPrefix);
      if (p) byId.set(p.source_listing_id!, p);
    }
  }
  const properties = Array.from(byId.values());
  console.log(`[HomeIQ:GovDeals] found ${properties.length} properties`);
  return properties;
}
