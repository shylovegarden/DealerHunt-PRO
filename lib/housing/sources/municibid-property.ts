// lib/housing/sources/municibid-property.ts
//
// Municibid REAL ESTATE (category C169135) — the housing sibling of the cars Municibid scraper. Same
// server-rendered ASP.NET browse cards (fully reachable from our IP, no login/proxy), but this category
// is tax-forfeited parcels, surplus municipal lots, and the occasional township house — deep-discount
// flip leads. Maps to Property (houses only → vertical-isolated from the cars `deals` table): no
// make/model/year is ever read, and every row carries an address/location, so a vehicle can't leak in.

import type { Property, PropertyType } from "../types";

const ORIGIN = "https://municibid.com";
// C169135 = the Real Estate category (verified live). list view · active only · ending-soonest sort.
const BROWSE = `${ORIGIN}/Browse/C169135/Real_Estate?ViewStyle=list&StatusFilter=active_only&SortFilterOptions=1`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const clean = (t: string): string =>
  t
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Convert Municibid's "7/9/2026 10:00:00 AM" end date to ISO, or undefined if unparseable. */
function parseEnd(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Infer a coarse property type from the listing title (surplus RE skews land/parcels). */
function classify(title: string): PropertyType {
  const s = title.toLowerCase();
  if (/mobile|manufactured/.test(s)) return "mobile";
  if (/multi|duplex|triplex|fourplex|apartment/.test(s)) return "multi_family";
  if (/condo/.test(s)) return "condo";
  if (/town(house|home)/.test(s)) return "townhouse";
  if (/commercial|warehouse|office|retail/.test(s)) return "commercial";
  if (/\bbed\b|\bbath\b|\bhouse\b|\bhome\b|residence|dwelling/.test(s))
    return "single_family";
  if (/\bland\b|lot|acre|parcel|forfeit|vacant|tract/.test(s)) return "land";
  return "land";
}

/** Parse a Municibid Real-Estate browse page into Property rows. */
export function parseMunicibidProperties(html: string): Property[] {
  const byId = new Map<string, Property>();
  // The id appears twice per card; split on it and keep, per id, the chunk that actually has a bid.
  const parts = html.split(/data-listingid="(\d+)"/);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    if (byId.has(id)) continue;
    const chunk = parts[i + 1] || "";

    const slug = (chunk.match(/\/Listing\/Details\/\d+\/([A-Za-z0-9._-]+)/) ||
      [])[1];
    if (!slug) continue;
    const title = clean(slug.replace(/[-_]+/g, " "));

    const text = clean(chunk);
    // Current bid / starting bid (shown even at 0 bids). No price => not yet live; skip.
    const pm = text.match(
      /CURRENT BID:\s*\$\s*([\d,]+(?:\.\d+)?)|(?:Current|Starting|Minimum)\s+Bid:?\s*\$\s*([\d,]+(?:\.\d+)?)/i,
    );
    const rawPrice = pm ? pm[1] || pm[2] : undefined;
    if (!rawPrice) continue;
    const price = Math.round(parseFloat(rawPrice.replace(/,/g, "")));
    if (!price) continue;

    // Location renders as "{City}, {ST} | {Agency}". The title repeats right before it, so strip the
    // title from the text first, then the run before ", {ST}" is the city. State is reliable regardless.
    const titleRe = new RegExp(
      title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"),
      "ig",
    );
    const noTitle = text.replace(titleRe, " ");
    const loc =
      noTitle.match(
        /([A-Z][a-z]+(?:[ .'-][A-Za-z]+){0,2})\s*,\s*([A-Z]{2})\s*\|/,
      ) ||
      text.match(/([A-Z][a-z]+(?:[ .'-][A-Za-z]+){0,2})\s*,\s*([A-Z]{2})\s*\|/);
    const state = loc ? loc[2] : undefined;
    const city = loc ? loc[1].trim() : undefined;
    const zip = (title.match(/\b(\d{5})\b/) || [])[1];

    const agency = (text.match(/\|\s*([^|]+?)\s+(?:BIDS?|Bid\(s\)):/i) ||
      [])[1];
    const bids = (text.match(/BIDS?:\s*(\d+)/i) || [])[1];
    const ends = (text.match(/End(?:ed|s)?:\s*([\d/]+\s[\d:]+\s?[AP]M)/i) ||
      [])[1];
    const img = (chunk.match(
      /<img[^>]+src="(https:\/\/storagemunicibid[^"]+\.(?:jpg|jpeg|png))"/i,
    ) || [])[1];

    byId.set(id, {
      source: "gov_auction",
      source_listing_id: `mbre-${id}`,
      source_url: `${ORIGIN}/Listing/Details/${id}`,
      title,
      property_type: classify(title),
      address: title,
      city,
      state,
      zip,
      price,
      seller_type: "gov",
      seller: agency ? agency.trim() : "Municibid (gov surplus)",
      bid_count: bids ? parseInt(bids, 10) : undefined,
      auction_end: parseEnd(ends),
      images: img ? [img] : [],
      description: title,
      signals: {
        auction: true,
        channel: "gov_real_estate",
        marketplace: "municibid",
      },
      scraped_at: new Date().toISOString(),
    });
  }
  return Array.from(byId.values());
}

export async function scrapeMunicibidProperties(): Promise<Property[]> {
  console.log("[HomeIQ:Municibid] harvesting real estate...");
  try {
    const res = await fetch(BROWSE, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) {
      console.warn(`[HomeIQ:Municibid] HTTP ${res.status}`);
      return [];
    }
    const properties = parseMunicibidProperties(await res.text());
    console.log(`[HomeIQ:Municibid] found ${properties.length} properties`);
    return properties;
  } catch (e) {
    console.warn("[HomeIQ:Municibid] failed:", (e as Error).message);
    return [];
  }
}
