// lib/housing/sources/cuyahoga-landbank.ts
//
// Cuyahoga County Land Reutilization Corp (cuyahogalandbank.org) — Cleveland's land bank, one of the
// largest in the US. Its "all available properties" page embeds every active parcel as a
// `var markersOnMap = [...]` JSON array in the SSR HTML (parcel #, precise lat/lng, image, and an
// address+status string) — parsed directly, no proxy. No price/beds/sqft on this view (so ARV stays
// unknown, like GovDeals), but every row is precisely geocoded. Houses only → vertical-isolated from the
// cars `deals` table (Property carries an address; no make/model/year is read).

import type { Property, PropertyType } from "../types";

const ORIGIN = "https://cuyahogalandbank.org";
const LIST_URL = `${ORIGIN}/all-available-properties/`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface Marker {
  ppn?: string;
  placeName?: string;
  LatLng?: { lat?: number; lng?: number };
  image?: string;
  content?: string;
}

function classify(text: string): PropertyType {
  const s = text.toLowerCase();
  if (/vacant lot|side lot|\bland\b|vacant land/.test(s)) return "land";
  if (/multi|duplex|two.?family|apartment/.test(s)) return "multi_family";
  if (/commercial|warehouse|retail|office/.test(s)) return "commercial";
  return "single_family"; // land-bank inventory is overwhelmingly houses
}

/** Pull `var markersOnMap = [...]` from the page (balanced-bracket extraction). */
function extractMarkers(html: string): Marker[] {
  const anchor = html.indexOf("markersOnMap");
  if (anchor < 0) return [];
  const start = html.indexOf("[", anchor);
  if (start < 0) return [];
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        try {
          const arr = JSON.parse(html.slice(start, i + 1));
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function toProperty(m: Marker): Property | null {
  const ppn = m.ppn || m.placeName;
  if (!ppn) return null;
  // content = "123 Main St, Cleveland, OH 44128<br><br>Renovation Underway - Available Soon"
  const content = (m.content || "").replace(/<br\s*\/?>/gi, " | ").trim();
  const addr = content.match(
    /^([^,|]+),\s*([A-Za-z .'-]+),\s*([A-Z]{2})\s*(\d{5})/,
  );
  const street = addr ? addr[1].trim() : undefined;
  const city = addr ? addr[2].trim() : "Cleveland";
  const state = addr ? addr[3] : "OH";
  const zip = addr ? addr[4] : undefined;
  // Status is whatever follows the address (after the <br> separators).
  const status = addr
    ? content
        .slice((addr[0] || "").length)
        .replace(/^[\s|,]+/, "")
        .trim()
    : content;

  const lat = m.LatLng?.lat;
  const lng = m.LatLng?.lng;
  return {
    source: "land_bank",
    source_listing_id: `cclb-${ppn}`,
    source_url: LIST_URL,
    title: street ? `${street}, ${city} ${state}` : `Parcel ${ppn}`,
    property_type: classify(content),
    address: street,
    city,
    state,
    zip,
    lat: typeof lat === "number" && Math.abs(lat) > 1 ? lat : undefined,
    lng: typeof lng === "number" && Math.abs(lng) > 1 ? lng : undefined,
    images: m.image ? [m.image] : [],
    seller_type: "gov",
    seller: "Cuyahoga Land Bank",
    description: status || undefined,
    signals: {
      land_bank: true,
      channel: "land_bank",
      marketplace: "cuyahoga_landbank",
      parcel: ppn,
      status: status || undefined,
    },
    scraped_at: new Date().toISOString(),
  };
}

/** Parse the Cuyahoga available-properties page into Property rows. */
export function parseCuyahogaLandBank(html: string): Property[] {
  const seen = new Set<string>();
  const out: Property[] = [];
  for (const m of extractMarkers(html)) {
    const p = toProperty(m);
    if (p && !seen.has(p.source_listing_id!)) {
      seen.add(p.source_listing_id!);
      out.push(p);
    }
  }
  return out;
}

export async function scrapeCuyahogaLandBank(): Promise<Property[]> {
  console.log("[HomeIQ:CuyahogaLandBank] harvesting...");
  try {
    const res = await fetch(LIST_URL, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) {
      console.warn(`[HomeIQ:CuyahogaLandBank] HTTP ${res.status}`);
      return [];
    }
    const properties = parseCuyahogaLandBank(await res.text());
    console.log(
      `[HomeIQ:CuyahogaLandBank] found ${properties.length} properties`,
    );
    return properties;
  } catch (e) {
    console.warn("[HomeIQ:CuyahogaLandBank] failed:", (e as Error).message);
    return [];
  }
}
