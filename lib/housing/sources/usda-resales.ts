// lib/housing/sources/usda-resales.ts
//
// USDA RD/FSA Resales (resales.usda.gov) — U.S. Department of Agriculture Rural Development
// and Farm Service Agency foreclosure properties, single-family homes, multi-family homes,
// and farms/ranches.
//
// We query the state drop-downs on searchSFH, searchMFH, and searchFSA pages to discover active
// states with counts, then POST to retrieve all listings directly from the rendered HTML table,
// avoiding headed browser overhead.
//
// Coverage: nationwide USDA inventory.
// Vertical: housing (seller_type = "gov", auction/foreclosure context)

import * as cheerio from "cheerio";
import type { Property, PropertyType } from "../types";

const BASE = "https://www.resales.usda.gov";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface UsdaCategory {
  path: string;
  propertyType: "Single Family" | "Multi-Family" | "Farm & Ranch";
  canonicalType: PropertyType;
}

const CATEGORIES: UsdaCategory[] = [
  {
    path: "/resales/public/searchSFH",
    propertyType: "Single Family",
    canonicalType: "single_family",
  },
  {
    path: "/resales/public/searchMFH",
    propertyType: "Multi-Family",
    canonicalType: "multi_family",
  },
  {
    path: "/resales/public/searchFSA",
    propertyType: "Farm & Ranch",
    canonicalType: "land", // Farm & Ranch is land-centric
  },
];

/** Parse active state codes (e.g. "28" for Mississippi) from the stateCode dropdown options. */
export function parseStateCodes(html: string): string[] {
  const $ = cheerio.load(html);
  const codes: string[] = [];
  $("#stateCode option").each((_, opt) => {
    const val = $(opt).val();
    if (val && String(val).trim()) {
      codes.push(String(val).trim());
    }
  });
  return codes;
}

function parseDollar(v: string | null | undefined): number | undefined {
  if (!v) return undefined;
  const n = Math.round(Number(v.replace(/[^0-9.]/g, "")));
  return isNaN(n) || n === 0 ? undefined : n;
}

/** Parse property records from the search results table page. */
export function parsePropertyTable(
  html: string,
  category: UsdaCategory,
): Property[] {
  const $ = cheerio.load(html);
  const properties: Property[] = [];

  $("#propertySummariesTable tbody tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 7) return; // invalid row

    const firstCell = $(cells[0]);
    const linkHref = firstCell.find("a").attr("href") || "";
    if (!linkHref) return; // missing details link

    const urlParams = new URLSearchParams(linkHref.split("?")[1] || "");
    const id = urlParams.get("id") || "";
    if (!id) return;

    const imgUrl = firstCell.find("img").attr("src") || "";
    const images =
      imgUrl &&
      !imgUrl.includes("No_Image") &&
      !imgUrl.includes("NoPropertyImage")
        ? [imgUrl.startsWith("/") ? `${BASE}${imgUrl}` : imgUrl]
        : undefined;

    const listingType = $(cells[1]).text().trim();
    const streetRaw = $(cells[2]).text().trim();
    // Strip trailing " Map" text
    const street = streetRaw
      .replace(/\s+Map$/i, "")
      .replace(/\s+/g, " ")
      .trim();

    const city = $(cells[3]).text().trim().replace(/,$/, "");
    const state = $(cells[4]).text().trim();
    const county = $(cells[5]).text().trim();
    const zip = $(cells[6]).text().trim();
    const priceRaw = $(cells[7]).text().trim();
    const price = parseDollar(priceRaw);

    const prop: Property = {
      source: "usda_resales",
      source_listing_id: `usda-${category.propertyType.toLowerCase().replace(/[^a-z]/g, "")}-${id}`,
      source_url: `${BASE}${linkHref}`,
      title: `${street}, ${city}, ${state}`,
      property_type: category.canonicalType,
      address: street,
      city,
      state,
      zip,
      price,
      seller_type: "gov",
      seller: "USDA",
      signals: { county },
      scraped_at: new Date().toISOString(),
    };

    if (images) {
      prop.images = images;
    }

    if (category.propertyType === "Single Family" && cells.length >= 11) {
      const beds = Number($(cells[8]).text().trim());
      const baths = Number($(cells[9]).text().trim());
      const sqft = Number(
        $(cells[10])
          .text()
          .trim()
          .replace(/[^0-9]/g, ""),
      );

      if (!isNaN(beds) && beds > 0) prop.beds = beds;
      if (!isNaN(baths) && baths > 0) prop.baths = baths;
      if (!isNaN(sqft) && sqft > 0) prop.sqft = sqft;
    } else if (category.propertyType === "Farm & Ranch" && cells.length >= 9) {
      // Acres field
      const acres = Number(
        $(cells[8])
          .text()
          .trim()
          .replace(/[^0-9.]/g, ""),
      );
      if (!isNaN(acres) && acres > 0) {
        prop.lot_size_acres = acres;
      }
    }

    properties.push(prop);
  });

  return properties;
}

/** Fetch page containing stateCode options to extract active states. */
async function fetchStateCodesPage(path: string): Promise<string[]> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`USDA GET failed: ${res.status} for ${path}`);
  const html = await res.text();
  return parseStateCodes(html);
}

/** POST to search endpoint for a specific state and property category. */
async function fetchStateProperties(
  category: UsdaCategory,
  stateCode: string,
): Promise<Property[]> {
  const postData = new URLSearchParams({
    stateCode,
    city: "",
    zipCode: "",
    propertyType: category.propertyType,
    listingType: "All Types",
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
    squareFootage: "",
    Search: "Search",
  });

  const body = postData.toString();
  const res = await fetch(`${BASE}${category.path}`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${BASE}${category.path}`,
      Accept: "text/html",
    },
    body,
  });

  if (!res.ok)
    throw new Error(`USDA POST failed: ${res.status} for ${category.path}`);
  const html = await res.text();
  return parsePropertyTable(html, category);
}

/**
 * Scrapes USDA-RD/FSA resale property lists.
 * Runs query iterations dynamically by pulling active FIPS-state codes first.
 */
export async function scrapeUsdaResales(delayMs = 800): Promise<Property[]> {
  console.log("[HomeIQ:USDA] harvesting USDA RD/FSA resale properties...");
  const properties: Property[] = [];

  for (const category of CATEGORIES) {
    try {
      const stateCodes = await fetchStateCodesPage(category.path);
      console.log(
        `[HomeIQ:USDA] Found ${stateCodes.length} active states for category ${category.propertyType}`,
      );

      for (const stateCode of stateCodes) {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        try {
          const batch = await fetchStateProperties(category, stateCode);
          properties.push(...batch);
          if (batch.length > 0) {
            console.log(
              `[HomeIQ:USDA]   ${category.propertyType} in State ${stateCode}: fetched ${batch.length} properties`,
            );
          }
        } catch (err) {
          console.warn(
            `[HomeIQ:USDA] warn: failed to fetch ${category.propertyType} for state ${stateCode}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.warn(
        `[HomeIQ:USDA] warn: failed to fetch states list for ${category.propertyType}:`,
        err,
      );
    }
  }

  console.log(
    `[HomeIQ:USDA] done — ${properties.length} total USDA resale properties harvested`,
  );
  return properties;
}
