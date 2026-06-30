// lib/housing/sources/bid4assets.ts
//
// Bid4Assets — government tax-lien and REO property auction platform (county sheriff sales,
// tax-delinquent auctions, HUD/VA/USDA surplus). Data flows through an internal Kendo Grid
// Ajax transport endpoint discovered via JS-bundle analysis (/js/client/search_functions.js):
//
//   POST /api/search/process?take=<n>&skip=<s>&page=<p>&pageSize=<n>
//   Headers: X-CSRF-Header-Token: <token from __RequestVerificationToken hidden input>
//            Cookie: XCSRFTOKEN=<cookie value>
//
// The CSRF token is a standard ASP.NET Data Protection anti-forgery token, issued on each
// GET /search response as both a Set-Cookie and a hidden form field. The cookie value and
// the hidden field value are the SAME string — just send both.
//
// Coverage: national tax-lien/government REO auctions. Residential real estate only.
// Vertical: housing (seller_type = "gov", auction context)

import * as cheerio from "cheerio";
import type { Property, PropertyType } from "../types";

const BASE = "https://www.bid4assets.com";
const SEARCH_PATH = "/search";
const API_PATH = "/api/search/process";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Fetch CSRF token (hidden form field) + session cookies from the /search page. */
async function fetchCsrf(): Promise<{ token: string; cookie: string }> {
  const res = await fetch(`${BASE}${SEARCH_PATH}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Bid4Assets CSRF fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Hidden anti-forgery token
  const token =
    $("input[name='__RequestVerificationToken']").val() ||
    html.match(/__RequestVerificationToken[^>]+value="([^"]+)"/i)?.[1] ||
    "";
  if (!token)
    throw new Error(
      "Bid4Assets: __RequestVerificationToken not found in /search page",
    );

  // Cookie string (join all set-cookie headers)
  const rawCookies = res.headers.getSetCookie?.() ?? [];
  const cookie = rawCookies.map((c) => c.split(";")[0]).join("; ");

  return { token: String(token), cookie };
}

export interface B4aListing {
  auctionId: number;
  assetTitle?: string;
  currentBid?: number;
  highBidAmount?: number;
  bidOpenTime?: string;
  bidCloseTime?: string;
  actualCloseTime?: string;
  thumbnailImageUrl?: string;
  mainImageUrl?: string;
  locatedCity?: string; // NOTE: Bid4Assets has city/state SWAPPED in the API response
  locatedState?: string; // locatedCity = state code, locatedState = city name (confirmed bug in their data)
  linkUrl?: string;
  bidCount?: number;
}

interface B4aResponse {
  data: B4aListing[];
  total: number;
  errors?: unknown;
}

async function fetchPage(
  pageNumber: number,
  token: string,
  cookie: string,
  pageSize = 100,
): Promise<B4aResponse> {
  const qs = new URLSearchParams({
    take: String(pageSize),
    skip: String((pageNumber - 1) * pageSize),
    page: String(pageNumber),
    pageSize: String(pageSize),
  });
  const url = `${BASE}${API_PATH}?${qs.toString()}`;

  const payload = {
    sort: "bidclosetime",
    sortorder: null,
    searchtrackingid: "",
    datehistory: null,
    type: "powersearch",
    criteria: "real estate",
    keywordtype: "a", // allWords shorthand
    searchfield: null,
    channel: null,
    category: null,
    subcategory: null,
    assetstatus: "l", // Live (API uses abbreviated form)
    locatedstate: null,
    zip: null,
    zipradius: null,
    sellerid: "",
    searchtype: "ps",
    currentsearchquerystring: "",
    page: pageNumber,
    pageSize,
    pageTake: pageSize,
    skip: (pageNumber - 1) * pageSize,
  };

  const body = JSON.stringify(payload);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json",
      Accept: "application/json",
      Referer: `${BASE}/search`,
      "X-CSRF-Header-Token": token,
      Cookie: cookie,
    },
    body,
  });

  if (!res.ok)
    throw new Error(`Bid4Assets API ${res.status} page ${pageNumber}`);
  return res.json() as Promise<B4aResponse>;
}

// Residential keyword filter: title must mention real estate/property/land type words.
// B4A has everything from cars to bonds — filter by title.
const RESIDENTIAL_RE =
  /\b(bedroom|bed\s|bath|sqft|sf|sfr|residential|house|home|condo|townhouse|lot\s|land\s|acre|parcel|real\s*estate|property|foreclosure|reo|lien|tax\s+sale)\b/i;

export function mapType(title: string): PropertyType {
  const t = title.toLowerCase();
  if (/lot|land|acre|parcel/.test(t)) return "land";
  if (/condo|condominium/.test(t)) return "condo";
  if (/townhome|townhouse/.test(t)) return "townhouse";
  if (/mobile|manufactured/.test(t)) return "mobile";
  return "single_family";
}

export function toProperty(l: B4aListing): Property | null {
  const title = l.assetTitle || "";
  if (!RESIDENTIAL_RE.test(title)) return null; // skip non-real-estate

  const price = l.highBidAmount || l.currentBid || undefined;

  // NOTE: Bid4Assets has city/state swapped in API response — locatedCity = state, locatedState = city
  const state = l.locatedCity?.trim(); // e.g. "TX"
  const city = l.locatedState?.trim(); // e.g. "Dallas"

  const images: string[] = [];
  if (l.mainImageUrl) images.push(l.mainImageUrl);
  else if (l.thumbnailImageUrl) images.push(l.thumbnailImageUrl);

  return {
    source: "bid4assets",
    source_listing_id: String(l.auctionId),
    source_url: l.linkUrl ? `${BASE}${l.linkUrl}` : undefined,
    title,
    property_type: mapType(title),
    city: city || undefined,
    state: state && state.length === 2 ? state : undefined,
    price,
    seller_type: "gov",
    auction_end: l.bidCloseTime || l.actualCloseTime || undefined,
    bid_count: l.bidCount && l.bidCount > 0 ? l.bidCount : undefined,
    images: images.length ? images : undefined,
    scraped_at: new Date().toISOString(),
  };
}

/**
 * Scrape Bid4Assets for all active residential real estate auctions.
 * Uses CSRF token flow: GET /search → extract token → POST /api/search/process.
 */
export async function scrapeBid4Assets(delayMs = 600): Promise<Property[]> {
  console.log(
    "[HomeIQ:Bid4Assets] harvesting Bid4Assets.com real estate auctions...",
  );

  const { token, cookie } = await fetchCsrf();

  // First page to get total count
  const first = await fetchPage(1, token, cookie, 100);
  const total = first.total ?? 0;
  const pageSize = 100;
  const totalPages = Math.ceil(total / pageSize);
  console.log(
    `[HomeIQ:Bid4Assets] ${total} listings (all categories) across ${totalPages} pages`,
  );

  const allResults = new Map<string, Property>();

  // Process first page
  for (const l of first.data ?? []) {
    const p = toProperty(l);
    if (p?.source_listing_id) allResults.set(p.source_listing_id, p);
  }

  // Remaining pages
  for (let page = 2; page <= totalPages; page++) {
    try {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const data = await fetchPage(page, token, cookie, pageSize);
      for (const l of data.data ?? []) {
        const p = toProperty(l);
        if (p?.source_listing_id) allResults.set(p.source_listing_id, p);
      }
    } catch (err) {
      console.warn(`[HomeIQ:Bid4Assets] warn: page ${page} failed:`, err);
    }
  }

  const results = Array.from(allResults.values());
  console.log(
    `[HomeIQ:Bid4Assets] done — ${results.length} real estate listings from Bid4Assets`,
  );
  return results;
}
