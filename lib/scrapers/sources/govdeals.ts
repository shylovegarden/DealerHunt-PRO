// lib/scrapers/sources/govdeals.ts
// GovDeals.com — the largest U.S. government-surplus auction marketplace (Liquidity Services). Police
// cruisers, municipal fleet sedans, public-works trucks sell here for a fraction of retail = prime
// cheap-acquisition leads for a flipping dealer, sibling to PublicSurplus. The site itself is an Angular
// SPA on a flagged-IP CDN, but its search backend is a plain public JSON API (maestro.lqdt1.com) that
// answers anonymous requests with static keys — captured by Antigravity (clean-IP browser) in
// docs/findings/govdeals-api.md, then verified reachable + parsed here. No login, no paid proxy.
//
// Auth model: the Ocp-Apim-Subscription-Key + x-api-key below are the site's own PUBLIC anonymous keys
// (shipped to every browser); x-user-id:-1 = anonymous; x-api-correlation-id is just a request-trace UUID.

import type { Deal } from "@/types";
import { upsertDeals } from "../pipeline";

const API = "https://maestro.lqdt1.com/search/list";

// Public anonymous keys the GovDeals web app sends on every search (not credentials — captured from the
// site's own XHR). If GovDeals rotates them, the scraper 401s and yields 0 (pruned by retention), no crash.
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "Ocp-Apim-Subscription-Key": "cf620d1d8f904b5797507dc5fd1fdb80",
  "x-api-key": "af93060f-337e-428c-87b8-c74b5837d6cd",
  "x-user-id": "-1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

// product_category_external_id codes for road vehicles (verified live): 94A Automobiles/Cars,
// 94Q Trucks/Trailers, t6 the parent vehicles bucket. OR'd so one query sweeps all cars + trucks.
const VEHICLE_CATEGORY_CODES = ["94A", "94Q", "t6"];

// A trace UUID is required by the API but its value is arbitrary; derive a deterministic-looking one per
// page (no Math.random — keeps the call reproducible and avoids the runtime's RNG ban in some contexts).
function correlationId(seed: number): string {
  const h = (n: number, len: number) =>
    Math.abs(n).toString(16).padStart(len, "0").slice(0, len);
  return `${h(seed * 2654435761, 8)}-${h(seed * 40503, 4)}-4${h(seed * 911, 3)}-8${h(seed * 7919, 3)}-${h(seed * 1000003, 12)}`;
}

interface GovDealsAsset {
  assetId?: number;
  accountId?: number;
  assetShortDescription?: string;
  makebrand?: string;
  model?: string;
  modelYear?: string;
  currentBid?: number;
  assetBidPrice?: number;
  bidCount?: number;
  locationCity?: string;
  locationState?: string;
  locationZip?: string;
  companyName?: string;
  displaySellerName?: string;
  assetAuctionEndDate?: string;
  assetAuctionEndDateUtc?: string;
  lotNumber?: string;
  photo?: string;
  isSoldAuction?: boolean;
}

/** Map one GovDeals API asset object to a Deal. Returns null for non-vehicles / unusable rows. */
export function govDealsAssetToDeal(a: GovDealsAsset): Partial<Deal> | null {
  const assetId = a.assetId;
  const accountId = a.accountId;
  if (assetId == null || accountId == null) return null;
  if (a.isSoldAuction) return null; // closed lot, not a live lead

  const year = a.modelYear ? parseInt(a.modelYear, 10) : undefined;
  if (!year || year < 1950 || year > 2030) return null; // model year => a real titled vehicle

  // currentBid is the live high bid (acquisition cost). Fall back to the opening bid price.
  const price = Math.round(Number(a.currentBid ?? a.assetBidPrice ?? 0));
  if (!price || price < 1) return null; // no live bid value => not a usable lead yet

  const title =
    (a.assetShortDescription || "").trim() ||
    [a.modelYear, a.makebrand, a.model].filter(Boolean).join(" ");

  return {
    source: "gov_auction",
    // assetId is unique per lot but namespaced per account; combine to be globally unique + stable.
    source_deal_id: `gd-${assetId}-${accountId}`,
    source_url: `https://www.govdeals.com/asset/${assetId}/${accountId}`,
    title,
    year,
    make: (a.makebrand || "").trim(),
    model: (a.model || "").trim(),
    ask_price: price,
    condition: "run_drive", // gov surplus; condition varies, treat as running unless the lot says otherwise
    location_city: a.locationCity?.trim() || undefined,
    location_state: a.locationState?.trim() || undefined,
    location_zip: a.locationZip?.trim() || undefined,
    seller_type: "auction",
    seller: (
      a.companyName ||
      a.displaySellerName ||
      "GovDeals (gov surplus)"
    ).trim(),
    bid_count: typeof a.bidCount === "number" ? a.bidCount : undefined,
    auction_end: a.assetAuctionEndDateUtc || a.assetAuctionEndDate || undefined,
    images: [], // CDN base unverified from our IP; raw filename kept in metadata for a clean-IP pass.
    metadata: {
      auction: true,
      channel: "gov_surplus",
      marketplace: "govdeals",
      lotNumber: a.lotNumber,
      photoFile: a.photo, // accountId_assetId_uuid.jpg — resolve to a full image URL on the fleet later
    },
    scraped_at: new Date().toISOString(),
  };
}

async function fetchPage(
  page: number,
  displayRows: number,
): Promise<GovDealsAsset[]> {
  const body = {
    businessId: "GD",
    searchText: "*",
    isQAL: false,
    page,
    displayRows,
    sortField: "timeremaining", // ending-soonest first => freshest, most actionable leads
    sortOrder: "asc",
    requestType: "search",
    responseStyle: "fullResponse",
    facetsFilter: VEHICLE_CATEGORY_CODES.map(
      (c) =>
        `{!tag=product_category_external_id}product_category_external_id:"${c}"`,
    ),
    accountIds: [],
  };
  const res = await fetch(API, {
    method: "POST",
    headers: { ...HEADERS, "x-api-correlation-id": correlationId(page + 1) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as { assetSearchResults?: GovDealsAsset[] };
  return json.assetSearchResults || [];
}

export async function scrapeGovDeals(maxPages = 8): Promise<number> {
  console.log("[GovDeals] Starting scrape...");
  const DISPLAY_ROWS = 120;
  const byId = new Map<string, Partial<Deal>>();
  let prevFirst = "";

  for (let page = 1; page <= maxPages; page++) {
    let rows: GovDealsAsset[];
    try {
      rows = await fetchPage(page, DISPLAY_ROWS);
    } catch (e) {
      console.warn(`[GovDeals] page ${page} failed:`, (e as Error).message);
      break;
    }
    if (!rows.length) break;

    // The API loops back to page 1 past the last real page — stop when the first lot repeats.
    const first = String(rows[0]?.assetId ?? "");
    if (first && first === prevFirst) break;
    prevFirst = first;

    for (const r of rows) {
      const deal = govDealsAssetToDeal(r);
      if (deal) byId.set(deal.source_deal_id!, deal);
    }
    if (rows.length < DISPLAY_ROWS) break; // last page
    await new Promise((r) => setTimeout(r, 800)); // be polite to the public API
  }

  const deals = Array.from(byId.values());
  console.log(`[GovDeals] Found ${deals.length} vehicle auctions`);
  if (deals.length > 0) await upsertDeals(deals);
  return deals.length;
}
