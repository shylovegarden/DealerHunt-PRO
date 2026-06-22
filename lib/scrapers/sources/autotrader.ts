// lib/scrapers/sources/autotrader.ts
// ─── AutoTrader scraper - Largest automotive marketplace ──────────────────────

import type { Deal } from "@/types";
import * as cheerio from "cheerio";
import {
  paginate,
  extractPrice,
  extractMileage,
  extractYear,
  normalizeUrl,
  type ScraperConfig,
} from "../engine";
import { upsertDeals } from "../pipeline";

export const AUTOTRADER_CONFIG: ScraperConfig = {
  name: "AutoTrader",
  baseUrl: "https://www.autotrader.com",
  renderMode: "browser", // Heavy JS site
  requestDelay: 4000, // Slow to avoid detection
  concurrency: 1,
  useProxies: true,
  stealth: true,
  maxPages: 15,
  headers: {
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
};

export async function scrapeAutoTrader(
  searchTerm = "",
  zip = "75201", // Dallas default
  maxPages = AUTOTRADER_CONFIG.maxPages,
) {
  console.log(
    `[AutoTrader] Starting scrape for "${searchTerm}" near ${zip}...`,
  );
  const allDeals: Partial<Deal>[] = [];

  const config = { ...AUTOTRADER_CONFIG, maxPages };
  const gen = paginate<Partial<Deal>>(
    config,
    (page) => {
      const baseUrl = "https://www.autotrader.com/cars-for-sale/all-cars";
      const params = new URLSearchParams({
        zip,
        searchRadius: "500",
        ...(searchTerm && { makeCodeList: searchTerm }),
        startYear: "2010",
        numRecords: "25",
        firstRecord: String((page - 1) * 25),
      });
      return `${baseUrl}?${params.toString()}`;
    },
    async (input) => {
      const $ = typeof input === "string" ? cheerio.load(input) : input;
      const items: Partial<Deal>[] = [];

      // AutoTrader uses data attributes and specific class names
      $(
        '[data-cmp="inventoryListing"], .inventory-listing, [data-testid="listing-card"], .listing-row',
      ).each((_: number, el: any) => {
        const row = $(el);

        // Extract title/year/make/model
        const title = row
          .find(
            '[data-cmp="subheading"], .listing-title, h2, [data-testid="listing-title"]',
          )
          .text()
          .trim();
        if (!title) return;

        // Extract price
        const priceText = row
          .find(
            '[data-cmp="pricing"], .first-price, .pricing-detail, [data-testid="listing-price"]',
          )
          .text()
          .trim();
        const price = extractPrice(priceText);
        if (!price) return;

        // Extract mileage
        const mileageText = row
          .find(
            '[data-cmp="mileage"], .item-card-specifications, [data-testid="listing-mileage"]',
          )
          .text()
          .trim();

        // Extract location
        const locationText = row
          .find(
            '[data-cmp="dealerLocation"], .dealer-location, [data-testid="dealer-location"]',
          )
          .text()
          .trim();

        // Extract dealer name
        const dealerText = row
          .find(
            '[data-cmp="sellerName"], .dealer-name, [data-testid="dealer-name"]',
          )
          .text()
          .trim();

        // Extract link
        const link =
          row.find('a[href*="/cars-for-sale/"]').attr("href") ||
          row.find("a").first().attr("href");

        // Extract image
        const imgSrc =
          row
            .find('img[data-cmp="image"], img.listing-image, img')
            .first()
            .attr("src") || row.find("img").first().attr("data-src");

        // Extract VIN or listing ID
        const vinText = row.find('[data-cmp="vin"], .vin-number').text().trim();
        const listingId = link?.match(/\/(\d+)$/)?.[1] || "";
        const itemId = vinText || listingId;

        // Parse year/make/model from title
        const titleParts = title.split(" ");
        const year = extractYear(title);
        const make = titleParts[year ? 1 : 0] || "";
        const model =
          titleParts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "";

        // Determine seller type
        const sellerType = dealerText.toLowerCase().includes("private")
          ? "private"
          : "dealer";

        items.push({
          source: "autotrader",
          source_deal_id: itemId,
          source_url: link ? normalizeUrl(link, AUTOTRADER_CONFIG.baseUrl) : "",
          title,
          year,
          make,
          model,
          vin: vinText,
          ask_price: price,
          mileage: extractMileage(mileageText),
          condition: "clean", // AutoTrader is mostly clean title
          location_city: locationText.split(",")[0]?.trim() || locationText,
          location_state: locationText.split(",")[1]?.trim() || "",
          images: imgSrc ? [imgSrc] : [],
          seller_type: sellerType,
          seller: dealerText || "AutoTrader",
          scraped_at: new Date().toISOString(),
        });
      });

      const hasMore =
        $(
          'a[aria-label="Go to next page"], .pagination-next, button[data-cmp="nextPage"]',
        ).length > 0;
      return { items, hasMore };
    },
  );

  for await (const batch of gen) {
    allDeals.push(...batch);
  }

  console.log(`[AutoTrader] Found ${allDeals.length} deals`);

  if (allDeals.length > 0) {
    await upsertDeals(allDeals);
  }

  return allDeals.length;
}
