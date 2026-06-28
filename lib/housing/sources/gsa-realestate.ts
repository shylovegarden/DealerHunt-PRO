// lib/housing/sources/gsa-realestate.ts
//
// GSA Real Estate (realestatesales.gov) — U.S. FEDERAL real-estate auctions (surplus agency housing,
// land, buildings). Net-new free housing leads, the real-estate sibling of gsaauctions.gov. Unlike that
// SPA, this is server-rendered: listings sit in `.itemm` cards (captured by Antigravity in
// docs/findings/gsa-realestate-api.md), so a plain GET + Cheerio pulls them. Houses only → Property rows
// (vertical-isolated from the cars `deals` table). No JS, no API, no proxy.

import * as cheerio from "cheerio";
import type { Property, PropertyType } from "../types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function typeFromTags(tags: string[]): PropertyType {
  const s = tags.join(" ").toLowerCase();
  if (/land|lot|acre/.test(s)) return "land";
  if (/commercial|industrial|office/.test(s)) return "commercial";
  if (/multi/.test(s)) return "multi_family";
  if (/residential|home|house|housing/.test(s)) return "single_family";
  return "other";
}

// "2107 Jackson Street Port Lavaca, TX 77979" → state + zip (reliable); city = the words before the comma.
function parseAddress(addr: string): {
  city?: string;
  state?: string;
  zip?: string;
} {
  const m = addr.match(/,\s*([A-Z]{2})\s+(\d{5})/);
  const state = m?.[1];
  const zip = m?.[2];
  let city: string | undefined;
  const beforeComma = addr.split(",")[0] || "";
  // City = the trailing 1–2 capitalized words, after any street suffix.
  const cm = beforeComma.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*$/);
  if (cm) city = cm[1];
  return { city, state, zip };
}

/** Parse the GSA real-estate listing page (.itemm cards) into Properties. */
export function parseGsaRealEstate(html: string): Property[] {
  const $ = cheerio.load(html);
  const out: Property[] = [];
  $(".itemm").each((_, el) => {
    const link = $(el).find("a").attr("href") || "";
    const propertyId = (link.split("property_id=")[1] || "").split(/[&#]/)[0];
    if (!propertyId) return;

    const title = $(el).find(".property-info h2").text().trim();
    const address = $(el)
      .find(".property-info h5")
      .text()
      .trim()
      .replace(/\s+/g, " ");
    const bidText = $(el).find(".property-price span").text().trim();
    const price = Math.round(Number(bidText.replace(/[^0-9.]/g, "")));
    if (!price) return;

    const img =
      $(el).find(".slide-img").attr("src") || $(el).find("img").attr("src");
    const dates = $(el).find(".covert_auction_date_range_all_listings");
    const endDate = dates.attr("data-end-date") || undefined;
    const tags: string[] = [];
    $(el)
      .find("ul.tags li h3")
      .each((_i, t) => {
        tags.push($(t).text().trim());
      });

    const loc = parseAddress(address);
    out.push({
      source: "gsa_realestate",
      source_listing_id: `gsare-${propertyId}`,
      source_url: `https://realestatesales.gov/asset-details/?property_id=${propertyId}`,
      title: title || address,
      property_type: typeFromTags(tags),
      address: address || undefined,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      price,
      images: img ? [img] : [],
      seller: "GSA (federal real estate)",
      seller_type: "gov",
      auction_end: endDate,
      signals: { channel: "gsa_realestate", marketplace: "gsa", tags },
      scraped_at: new Date().toISOString(),
    });
  });
  return out;
}

export async function scrapeGsaRealEstate(): Promise<Property[]> {
  console.log("[HomeIQ:GSA-RE] harvesting federal real estate...");
  try {
    const res = await fetch("https://realestatesales.gov/our-listing/", {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return [];
    const props = parseGsaRealEstate(await res.text());
    console.log(`[HomeIQ:GSA-RE] found ${props.length} properties`);
    return props;
  } catch (e) {
    console.warn("[HomeIQ:GSA-RE] failed:", (e as Error).message);
    return [];
  }
}
