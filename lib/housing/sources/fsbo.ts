// lib/housing/sources/fsbo.ts
//
// FSBO.com — "For Sale By Owner" national listings. The site is a Next.js App Router app that bails
// out to client-side rendering, but the underlying data comes from a clean undocumented JSON API:
//
//   GET /api/fsbo/listings/search?q=<city,ST>&propertyType=SINGLE_FAMILY&limit=500&page=<n>
//
// This endpoint is open (no auth), returns full structured listing objects, and supports pagination.
// We discovered this by inspecting the bundled JS (10locokxyoks7.js) for fetch patterns. The API
// yields all the fields we need directly — no HTML parsing required.
//
// Coverage: national FSBO listings. Search by city/state text query.
// Vertical: housing (seller_type = "owner")

import type { Property, PropertyType } from "../types";

const BASE = "https://fsbo.com";
const SEARCH_PATH = "/api/fsbo/listings/search";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// FSBO property type → our canonical type
function mapType(t: string | null | undefined): PropertyType {
  if (!t) return "other";
  switch (t.toUpperCase()) {
    case "SINGLE_FAMILY":
      return "single_family";
    case "MULTI_FAMILY":
      return "multi_family";
    case "CONDO":
      return "condo";
    case "TOWNHOUSE":
      return "townhouse";
    case "LAND":
      return "land";
    case "MOBILE_MANUFACTURED":
      return "mobile";
    case "COMMERCIAL":
      return "commercial";
    default:
      return "other";
  }
}

interface FsboListing {
  id: string;
  addressSlug?: string;
  headline: string;
  description?: string;
  city?: string;
  state?: string;
  zip?: string;
  street?: string;
  propertyType?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  askingPrice?: number;
  latitude?: number;
  longitude?: number;
  primaryPhotoUrl?: string;
  photoUrls?: string[];
}

interface FsboSearchResponse {
  listings: FsboListing[];
  total?: number;
  page?: number;
}

async function fetchPage(
  query: string,
  page: number,
  propertyType = "SINGLE_FAMILY",
  limit = 500,
): Promise<FsboSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    propertyType,
    limit: String(limit),
    page: String(page),
  });
  const url = `${BASE}${SEARCH_PATH}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "https://fsbo.com/search",
    },
  });
  if (!res.ok) throw new Error(`FSBO API ${res.status} for ${url}`);
  return res.json() as Promise<FsboSearchResponse>;
}

function toProperty(l: FsboListing): Property {
  const address = [l.street, l.city, l.state, l.zip].filter(Boolean).join(", ");
  // askingPrice comes in cents (×100) from the API — confirmed: $774,900 → 77490000
  const price = l.askingPrice ? Math.round(l.askingPrice / 100) : undefined;
  const images = (
    l.photoUrls ?? (l.primaryPhotoUrl ? [l.primaryPhotoUrl] : [])
  ).map((p) => (p.startsWith("/") ? `${BASE}${p}` : p));

  return {
    source: "fsbo",
    source_listing_id: l.id,
    source_url: l.addressSlug
      ? `${BASE}/search/${l.addressSlug}`
      : `${BASE}/search?q=${encodeURIComponent(l.city && l.state ? `${l.city}, ${l.state}` : "")}`,
    title: l.headline || address,
    property_type: mapType(l.propertyType),
    address: l.street,
    city: l.city,
    state: l.state,
    zip: l.zip,
    lat: l.latitude,
    lng: l.longitude,
    price,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    year_built: l.yearBuilt,
    description: l.description,
    seller_type: "owner",
    images: images.length ? images : undefined,
    scraped_at: new Date().toISOString(),
  };
}

/**
 * Scrape FSBO.com for a specific city/state query (e.g. "Dallas, TX").
 * Paginates automatically until the API returns fewer than `limit` results.
 */
export async function scrapeFsboQuery(
  query: string,
  propertyType = "SINGLE_FAMILY",
  delayMs = 500,
): Promise<Property[]> {
  const limit = 500;
  const results: Property[] = [];
  let page = 1;

  while (true) {
    const data = await fetchPage(query, page, propertyType, limit);
    const batch = (data.listings ?? []).map(toProperty);
    results.push(...batch);
    if (batch.length < limit) break; // last page
    page++;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  return results;
}

// Top-50 metro queries covering the national FSBO market (FSBO.com is USA-only).
const METRO_QUERIES = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "San Jose, CA",
  "Austin, TX",
  "Jacksonville, FL",
  "Fort Worth, TX",
  "Columbus, OH",
  "Charlotte, NC",
  "Indianapolis, IN",
  "San Francisco, CA",
  "Seattle, WA",
  "Denver, CO",
  "Nashville, TN",
  "Oklahoma City, OK",
  "El Paso, TX",
  "Washington, DC",
  "Las Vegas, NV",
  "Louisville, KY",
  "Memphis, TN",
  "Portland, OR",
  "Baltimore, MD",
  "Milwaukee, WI",
  "Albuquerque, NM",
  "Tucson, AZ",
  "Fresno, CA",
  "Sacramento, CA",
  "Mesa, AZ",
  "Omaha, NE",
  "Kansas City, MO",
  "Atlanta, GA",
  "Colorado Springs, CO",
  "Raleigh, NC",
  "Long Beach, CA",
  "Virginia Beach, VA",
  "Minneapolis, MN",
  "Tampa, FL",
  "New Orleans, LA",
  "Wichita, KS",
  "Arlington, TX",
  "Cleveland, OH",
  "Bakersfield, CA",
  "Aurora, CO",
  "Orlando, FL",
];

/**
 * Full national harvest — queries all major metros across all property types.
 * Returns deduplicated Property records by source_listing_id.
 */
export async function scrapeFsbo(delayMs = 800): Promise<Property[]> {
  console.log("[HomeIQ:FSBO] harvesting FSBO.com national listings...");

  const allResults = new Map<string, Property>();

  const propertyTypes = [
    "SINGLE_FAMILY",
    "MULTI_FAMILY",
    "CONDO",
    "TOWNHOUSE",
    "LAND",
  ];

  for (const query of METRO_QUERIES) {
    for (const ptype of propertyTypes) {
      try {
        const batch = await scrapeFsboQuery(query, ptype, delayMs);
        for (const p of batch) {
          if (p.source_listing_id) allResults.set(p.source_listing_id, p);
        }
        if (batch.length > 0) {
          console.log(
            `[HomeIQ:FSBO]   ${query} ${ptype}: ${batch.length} listings (total ${allResults.size})`,
          );
        }
      } catch (err) {
        console.warn(`[HomeIQ:FSBO] warn: ${query} ${ptype} failed:`, err);
      }
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const results = Array.from(allResults.values());
  console.log(`[HomeIQ:FSBO] done — ${results.length} unique FSBO listings`);
  return results;
}
