import * as cheerio from "cheerio";
import type { Property, PropertyType } from "../types";

const US_STATES = [
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
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const num = (v: unknown): number | undefined => {
  if (v == null) return undefined;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return isFinite(n) && n !== 0 ? n : undefined;
};

function classify(raw: string): PropertyType {
  const s = (raw || "").toLowerCase();
  if (s.includes("multi") || s.includes("duplex")) return "multi_family";
  if (s.includes("condo")) return "condo";
  if (s.includes("town")) return "townhouse";
  if (s.includes("manufactured") || s.includes("mobile")) return "mobile";
  if (s.includes("land") || s.includes("lot")) return "land";
  if (s.includes("single") || s.includes("home") || s.includes("family"))
    return "single_family";
  return "single_family";
}

export function parseHomeStepsListings(html: string): {
  properties: Property[];
  total: number;
} {
  const $ = cheerio.load(html);
  const totalText =
    $("#property-header .cell").first().text() || "0 properties";
  const total = num(totalText.replace(/properties|property/g, "")) || 0;

  const properties: Property[] = [];

  $(".item-list ul li").each((i, el) => {
    const li = $(el);
    const link = li.find("a.no-decoration");
    if (!link.length) return;

    const sourceListingId =
      link.attr("id")?.replace("node-", "") ||
      link.attr("href")?.split("/").pop();
    if (!sourceListingId) return;

    const urlPath = link.attr("href") || "";
    const sourceUrl = urlPath.startsWith("http")
      ? urlPath
      : `https://www.homesteps.com${urlPath}`;

    // Extract basic fields from the teaser DOM
    const image = link.find(".property-image img").attr("src");
    const status =
      link.find(".property-status-value").text().trim() || "Active";

    // There is a <script type="application/ld+json"> tag inside the list item
    const scriptTag = li.find("script[type='application/ld+json']");
    let jsonLd: any = null;
    if (scriptTag.length) {
      try {
        jsonLd = JSON.parse(scriptTag.html() || "{}");
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    let price: number | undefined;
    let beds: number | undefined;
    let baths: number | undefined;
    let address: string | undefined;
    let city: string | undefined;
    let state: string | undefined;
    let zip: string | undefined;
    let title: string | undefined;
    let type: PropertyType = "single_family";

    if (jsonLd) {
      title = jsonLd.name;
      const loc = jsonLd["@location"]?.address || {};
      address = loc.streetAddress;
      city = loc.addressLocality;
      state = loc.addressRegion;
      zip = loc.postalCode;

      const offers = jsonLd.offers || {};
      price = num(offers.price);

      const item = offers.itemOffered || {};
      beds = num(item.numberOfBedrooms);
      baths = num(item.numberOfBathroomsTotal);
      type = classify(item.accommodationCategory || "");
    } else {
      // Fallback to DOM parsing
      price = num(link.find(".property-price").text());
      const details = link.find(".property-details").text();
      const bedsMatch = details.match(/(\d+)\s*beds?/i);
      const bathsMatch = details.match(/(\d+)\s*baths?/i);
      if (bedsMatch) beds = num(bedsMatch[1]);
      if (bathsMatch) baths = num(bathsMatch[1]);

      const addressText = link.find(".property-address").text();
      const parts = addressText.split(",").map((p) => p.trim());
      if (parts.length >= 3) {
        address = parts[0];
        city = parts[1];
        state = parts[2].substring(0, 2);
        zip = parts[2].substring(2).trim();
      }
      title = addressText.replace(/\s+/g, " ").trim();
    }

    if (!price) return;

    // Use regex to find sqft in details text if not in JSON
    const detailsFull = link.find(".property-details").text();
    const sqftMatch = detailsFull.match(/([0-9,]+)\s*sq\.\s*ft\./i);
    const sqft = sqftMatch ? num(sqftMatch[1]) : undefined;

    properties.push({
      source: "homesteps",
      source_listing_id: `homesteps-${sourceListingId}`,
      source_url: sourceUrl,
      title: title || [address, city, state].filter(Boolean).join(", "),
      property_type: type,
      description: `Freddie Mac HomeSteps — ${status}`,
      address,
      city,
      state,
      zip,
      price,
      beds,
      baths,
      sqft,
      images: image ? [image] : [],
      seller: "Freddie Mac",
      seller_type: "gov",
      signals: { channel: "reo", status, marketplace: "homesteps" },
      scraped_at: new Date().toISOString(),
    });
  });

  return { properties, total };
}

export async function scrapeHomeStepsState(
  state: string,
  delayMs = 500,
): Promise<Property[]> {
  const properties: Property[] = [];
  let page = 0;
  let totalProperties = 0;

  do {
    try {
      const url = `https://www.homesteps.com/listing/search?search=${state}&page=${page}`;
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        console.warn(
          `[HomeIQ:HomeSteps] ${state} page ${page} failed: ${res.status}`,
        );
        break;
      }

      const html = await res.text();
      const { properties: parsed, total } = parseHomeStepsListings(html);
      properties.push(...parsed);
      totalProperties = total;

      if (parsed.length === 0) break; // no results or end of pagination
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    } catch (e) {
      console.warn(`[HomeIQ:HomeSteps] ${state} page ${page} error:`, e);
      break;
    }
    page++;
  } while (properties.length < totalProperties && properties.length < 500); // 500 safety limit

  return properties;
}

export async function scrapeHomeSteps(
  states = US_STATES,
  delayMs = 500,
): Promise<Property[]> {
  console.log("[HomeIQ:HomeSteps] harvesting Freddie Mac REO homes...");
  const byId = new Map<string, Property>();

  for (const st of states) {
    const props = await scrapeHomeStepsState(st, delayMs);
    for (const p of props) {
      byId.set(p.source_listing_id!, p);
    }
  }

  const properties = Array.from(byId.values());
  console.log(`[HomeIQ:HomeSteps] found ${properties.length} homes`);
  return properties;
}
