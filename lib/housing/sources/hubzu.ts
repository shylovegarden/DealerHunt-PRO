// lib/housing/sources/hubzu.ts
//
// Hubzu.com — REO/foreclosure auction platform (formerly Ocwen). Hubzu is an Angular SPA, but its
// listing data is served by an undocumented JSON endpoint discovered via JS-bundle analysis:
//
//   GET /portal/auctions?pageSize=100&pageNumber=<n>&stateCode=<ST>
//
// The endpoint is open (no auth), returns full structured auction data with address, beds/baths,
// sqft, bid/ask price, lat/lng, photos, and auction countdown. The XSSI prefix (")]}'," ) must be
// stripped before JSON parsing.
//
// Coverage: ~2,300 national REO/foreclosure auction listings at any time. Filters to residential only.
// Vertical: housing (seller_type = "bank")

import type { Property, PropertyType } from "../types";

const BASE = "https://www.hubzu.com";
const AUCTION_PATH = "/portal/auctions";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Hubzu propertySubType → our canonical PropertyType
function mapType(subType: string | null | undefined): PropertyType {
  if (!subType) return "other";
  const s = subType.toLowerCase();
  if (/single.family|sfr/.test(s)) return "single_family";
  if (/condo/.test(s)) return "condo";
  if (/townhouse|town home/.test(s)) return "townhouse";
  if (/multi|duplex|triplex/.test(s)) return "multi_family";
  if (/mobile|manufactured/.test(s)) return "mobile";
  if (/commercial/.test(s)) return "commercial";
  if (/land|lot/.test(s)) return "land";
  return "other";
}

interface HubzuAddress {
  streetNumber?: string;
  streetName?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
}

interface HubzuListing {
  propertyId: string;
  listingId?: string;
  listingUrl?: string;
  propertySubType?: string;
  size?: string; // sqft as string
  bedCount?: string;
  bathCount?: string;
  imageUrl?: string;
  imageList?: string[];
  propAddress?: HubzuAddress;
  propAddressString?: string;
  currentBid?: number | string;
  startingBid?: number | string;
  listingPrice?: number | string;
  ownItNowPrice?: string;
  lat?: number | string;
  lng?: number | string;
  shortDescription?: string;
  marketingDescription?: string;
  listingEndDate?: string;
  bidOfferCount?: number | string;
  propertyCategory?: string; // REO, Short Sale, etc.
  listingType?: string; // AUCN = auction, TRNL = traditional
}

interface HubzuResponse {
  data: {
    srpTupples?: HubzuListing[];
    totalResultCount?: number;
    recordPerPage?: number;
    pageNumber?: number;
    remainingResultCount?: number;
  };
}

function parseDollar(
  v: number | string | null | undefined,
): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return isNaN(n) || n === 0 ? undefined : n;
}

function toProperty(l: HubzuListing): Property {
  const addr = l.propAddress;
  const streetAddr = addr
    ? [addr.streetNumber, addr.streetName].filter(Boolean).join(" ").trim()
    : undefined;

  const photos = (l.imageList ?? (l.imageUrl ? [l.imageUrl] : []))
    .filter(Boolean)
    .map((p) =>
      p.startsWith("//") ? "https:" + p : p.startsWith("/") ? `${BASE}${p}` : p,
    );

  const price =
    parseDollar(l.listingPrice) ??
    parseDollar(l.currentBid) ??
    parseDollar(l.startingBid) ??
    parseDollar(l.ownItNowPrice);

  const lat = l.lat ? Number(l.lat) : undefined;
  const lng = l.lng ? Number(l.lng) : undefined;

  return {
    source: "hubzu",
    source_listing_id: l.listingId || l.propertyId,
    source_url: l.listingUrl ? `${BASE}${l.listingUrl}` : undefined,
    title:
      l.shortDescription ||
      (streetAddr && addr?.city
        ? `${streetAddr}, ${addr.city}, ${addr?.state || ""}`
        : "Hubzu REO"),
    property_type: mapType(l.propertySubType),
    address: streetAddr,
    city: addr?.city,
    state: addr?.state,
    zip: addr?.zip,
    lat: lat && !isNaN(lat) ? lat : undefined,
    lng: lng && !isNaN(lng) ? lng : undefined,
    price,
    beds: l.bedCount ? Number(l.bedCount) || undefined : undefined,
    baths: l.bathCount ? Number(l.bathCount) || undefined : undefined,
    sqft: l.size ? Number(l.size) || undefined : undefined,
    description: l.marketingDescription || l.shortDescription,
    seller_type: "bank",
    seller: l.propertyCategory || "REO",
    auction_end: l.listingEndDate,
    bid_count: l.bidOfferCount
      ? Number(l.bidOfferCount) || undefined
      : undefined,
    images: photos.length ? photos : undefined,
    scraped_at: new Date().toISOString(),
  };
}

async function fetchPage(
  pageNumber: number,
  pageSize = 100,
  stateCode?: string,
): Promise<HubzuResponse["data"]> {
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    pageNumber: String(pageNumber),
  });
  if (stateCode) params.set("stateCode", stateCode);

  const url = `${BASE}${AUCTION_PATH}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://www.hubzu.com/",
    },
  });

  if (!res.ok) throw new Error(`Hubzu HTTP ${res.status} for ${url}`);
  // Strip Angular XSSI prefix before parsing
  const text = await res.text();
  const clean = text.replace(/^\)\]\}',?\s*/, "");
  const parsed = JSON.parse(clean) as HubzuResponse;
  return parsed.data;
}

// Residential property sub-types to keep (exclude commercial, land-only)
const RESIDENTIAL_TYPES = new Set([
  "single family",
  "sfr",
  "condo",
  "condo / apartment",
  "townhouse",
  "town home",
  "multi family",
  "duplex",
  "triplex",
  "mobile",
  "manufactured",
]);

function isResidential(l: HubzuListing): boolean {
  if (!l.propertySubType) return true; // keep unknowns
  const t = l.propertySubType.toLowerCase();
  return (
    RESIDENTIAL_TYPES.has(t) || /family|condo|town|mobile|manufactured/.test(t)
  );
}

/**
 * Scrape Hubzu.com for all active REO/foreclosure listings.
 * Paginates the /portal/auctions endpoint until all pages are fetched.
 */
export async function scrapeHubzu(delayMs = 600): Promise<Property[]> {
  console.log("[HomeIQ:Hubzu] harvesting Hubzu.com REO listings...");
  const allResults = new Map<string, Property>();
  const pageSize = 100;

  // First page to get total count
  const first = await fetchPage(1, pageSize);
  const total = first.totalResultCount ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  console.log(
    `[HomeIQ:Hubzu] ${total} total listings across ${totalPages} pages`,
  );

  // Process first page
  for (const l of (first.srpTupples ?? []).filter(isResidential)) {
    const p = toProperty(l);
    if (p.source_listing_id) allResults.set(p.source_listing_id, p);
  }

  // Remaining pages
  for (let page = 2; page <= totalPages; page++) {
    try {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const data = await fetchPage(page, pageSize);
      for (const l of (data.srpTupples ?? []).filter(isResidential)) {
        const p = toProperty(l);
        if (p.source_listing_id) allResults.set(p.source_listing_id, p);
      }
      if (page % 5 === 0) {
        console.log(
          `[HomeIQ:Hubzu]   page ${page}/${totalPages} (${allResults.size} unique so far)`,
        );
      }
    } catch (err) {
      console.warn(`[HomeIQ:Hubzu] warn: page ${page} failed:`, err);
    }
  }

  const results = Array.from(allResults.values());
  console.log(
    `[HomeIQ:Hubzu] done — ${results.length} unique Hubzu REO listings`,
  );
  return results;
}
