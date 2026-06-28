// lib/housing/sources/detroit-landbank.ts
//
// Detroit Land Bank Authority (buildingdetroit.org) — the nation's largest municipal land bank: tens of
// thousands of tax-foreclosed / city-owned houses sold cheap ("Own It Now" fixed-price, "List Only"
// offers from $1,000, and auctions). The site is an Angular SPA, but each browse page embeds its first
// result set as a `var listingsdata = {...}` JSON blob in the SSR HTML — rich rows with lat/lng, sqft,
// beds, baths, image — so we parse it directly (no proxy, no API reverse-engineering). Houses only →
// vertical-isolated from the cars `deals` table (Property carries an address; no make/model/year is read).

import type { Property, PropertyType } from "../types";

const ORIGIN = "https://buildingdetroit.org";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// `properties` is the superset of all active for-sale inventory (List Only + Own It Now + Auction all
// appear here); the per-program paths are filtered subsets of it. Skip `pastlistings` (35k sold comps —
// useful later for ARV, not active leads).
const CATEGORIES = ["properties"];

interface DlbListing {
  property_id?: string;
  property_name?: string;
  property_identifier?: string;
  price?: string;
  minimum_offer?: string;
  current_minimum_bid?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  address?: string;
  area?: string;
  bedrooms?: string;
  bathrooms?: string;
  latitude?: string;
  longitude?: string;
  file_path?: string;
  neighbourhood?: string;
  category_type?: string;
  sale_date?: string;
  auction_closing_time?: string | null;
  short_description?: string;
}

const num = (v: string | undefined | null): number | undefined => {
  if (v == null) return undefined;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? n : undefined;
};

function classify(l: DlbListing): PropertyType {
  const s =
    `${l.property_name || ""} ${l.short_description || ""} ${l.category_type || ""}`.toLowerCase();
  if (/side lot|vacant|\blot\b|\bland\b|parcel/.test(s)) return "land";
  if (/multi|duplex|two.?family|2.?family|apartment/.test(s))
    return "multi_family";
  if (/commercial|warehouse|retail|office/.test(s)) return "commercial";
  return "single_family"; // land-bank inventory is overwhelmingly houses
}

/** Pull the `var listingsdata = {...}` blob out of a DLBA browse page (balanced-brace extraction). */
function extractListingsData(html: string): DlbListing[] {
  const anchor = html.indexOf("var listingsdata");
  if (anchor < 0) return [];
  const start = html.indexOf("{", anchor);
  if (start < 0) return [];
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          const obj = JSON.parse(html.slice(start, i + 1));
          return Array.isArray(obj?.listings) ? obj.listings : [];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

/** Map one DLBA listing to a Property. Acquisition price = the lowest real entry cost. */
function toProperty(l: DlbListing): Property | null {
  if (!l.property_id) return null;
  // Entry cost a flipper actually pays: min offer / current bid / fixed price, first positive.
  const price =
    num(l.minimum_offer) ?? num(l.current_minimum_bid) ?? num(l.price);
  const lat = num(l.latitude);
  const lng = num(l.longitude);
  const id = String(l.property_id);
  return {
    source: "land_bank",
    source_listing_id: `dlb-${id}`,
    source_url: l.property_identifier
      ? `${ORIGIN}/property/${l.property_identifier}`
      : `${ORIGIN}/properties`,
    title: l.property_name || l.address || `DLBA ${id}`,
    property_type: classify(l),
    address: l.property_name || l.address,
    city: l.city || "Detroit",
    state: l.state || "MI",
    zip: l.zipcode || undefined,
    // The site emits longitude as a positive magnitude; US longitudes are all negative (western
    // hemisphere), so force the sign — otherwise Detroit plots in China.
    lat: lat != null && Math.abs(lat) > 1 ? lat : undefined,
    lng: lng != null && Math.abs(lng) > 1 ? -Math.abs(lng) : undefined,
    price,
    beds: num(l.bedrooms),
    baths: num(l.bathrooms),
    sqft: num(l.area),
    images: l.file_path ? [l.file_path] : [],
    seller_type: "gov",
    seller: "Detroit Land Bank Authority",
    auction_end: l.auction_closing_time || undefined,
    description: l.short_description || undefined,
    signals: {
      land_bank: true,
      channel: "land_bank",
      marketplace: "detroit_landbank",
      sale_type: l.category_type,
      list_price: num(l.price),
      neighborhood: l.neighbourhood,
    },
    scraped_at: new Date().toISOString(),
  };
}

/** Parse one DLBA browse-page HTML into Property rows. */
export function parseDetroitLandBank(html: string): Property[] {
  return extractListingsData(html)
    .map(toProperty)
    .filter((p): p is Property => p != null);
}

export async function scrapeDetroitLandBank(
  maxPagesPerCat = 6,
): Promise<Property[]> {
  console.log("[HomeIQ:DetroitLandBank] harvesting...");
  const byId = new Map<string, Property>();
  for (const cat of CATEGORIES) {
    for (let page = 1; page <= maxPagesPerCat; page++) {
      try {
        const url = `${ORIGIN}/${cat}?view=grid${page > 1 ? `&page=${page}` : ""}`;
        const res = await fetch(url, {
          headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
        });
        if (!res.ok) break;
        const items = parseDetroitLandBank(await res.text());
        if (!items.length) break;
        for (const p of items) byId.set(p.source_listing_id!, p);
        if (items.length < 15) break; // last page of this category
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        console.warn(
          `[HomeIQ:DetroitLandBank] ${cat} p${page} failed:`,
          (e as Error).message,
        );
        break;
      }
    }
  }
  const properties = Array.from(byId.values());
  console.log(`[HomeIQ:DetroitLandBank] found ${properties.length} properties`);
  return properties;
}
