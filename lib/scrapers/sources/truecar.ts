// lib/scrapers/sources/truecar.ts
// ─── TrueCar scraper - Certified pre-owned with market value data ─────────────

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

export const TRUECAR_CONFIG: ScraperConfig = {
  name: "TrueCar",
  baseUrl: "https://www.truecar.com",
  renderMode: "browser", // API-driven React app
  requestDelay: 3500,
  concurrency: 1,
  useProxies: true,
  stealth: true,
  maxPages: 12,
  headers: {
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
};

export async function scrapeTrueCar(
  searchTerm = "",
  zip = "75201",
  maxPages = TRUECAR_CONFIG.maxPages,
) {
  console.log(`[TrueCar] Starting scrape for "${searchTerm}" near ${zip}...`);
  const allDeals: Partial<Deal>[] = [];

  const config = { ...TRUECAR_CONFIG, maxPages };
  const gen = paginate<Partial<Deal>>(
    config,
    (page) => {
      const baseUrl = "https://www.truecar.com/used-cars-for-sale/listings";
      const params = new URLSearchParams({
        zip,
        searchRadius: "500",
        ...(searchTerm && { searchText: searchTerm }),
        page: String(page),
      });
      return `${baseUrl}?${params.toString()}`;
    },
    async (input) => {
      const $ = typeof input === "string" ? cheerio.load(input) : input;
      const items: Partial<Deal>[] = [];

      // TrueCar uses specific data attributes and class names
      $(
        '[data-test="usedListing"], .card-content, [data-testid="listing-card"]',
      ).each((_: number, el: any) => {
        const row = $(el);

        // Extract title
        const title = row
          .find('[data-test="vehicleCardTitle"], .vehicle-card-title, h3')
          .text()
          .trim();
        if (!title) return;

        // Extract price
        const priceText = row
          .find(
            '[data-test="vehicleCardPricingBlockPrice"], .vehicle-price, .price-section',
          )
          .text()
          .trim();
        const price = extractPrice(priceText);
        if (!price) return;

        // Extract market value (TrueCar specialty)
        const marketValueText = row
          .find('[data-test="marketValue"], .market-value, .avg-price')
          .text()
          .trim();
        const marketValue = extractPrice(marketValueText);

        // Calculate savings vs market
        let savingsVsMarket = 0;
        if (marketValue && price < marketValue) {
          savingsVsMarket = marketValue - price;
        }

        // Extract mileage
        const mileageText = row
          .find('[data-test="vehicleMileage"], .mileage, .vehicle-mileage')
          .text()
          .trim();

        // Extract location
        const locationText = row
          .find(
            '[data-test="vehicleCardLocation"], .dealer-location, .location',
          )
          .text()
          .trim();

        // Extract dealer
        const dealerText = row
          .find('[data-test="dealerName"], .dealer-name')
          .text()
          .trim();

        // Extract link
        const link =
          row.find('a[href*="/used-cars-for-sale/"]').attr("href") ||
          row.find("a").first().attr("href");

        // Extract image
        const imgSrc =
          row.find('img[data-test="vehicleImage"], img').first().attr("src") ||
          row.find("img").first().attr("data-src");

        // Extract VIN or listing ID
        const vinText = row.find('[data-test="vin"], .vin').text().trim();
        const listingId = link?.match(/\/listing\/([^\/]+)/)?.[1] || "";
        const itemId = vinText || listingId;

        // Parse year/make/model
        const titleParts = title.split(" ");
        const year = extractYear(title);
        const make = titleParts[year ? 1 : 0] || "";
        const model =
          titleParts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "";

        // Extract certified status
        const isCertified =
          row.find('[data-test="certified"], .certified-badge').length > 0 ||
          title.toLowerCase().includes("certified");

        items.push({
          source: "truecar",
          source_deal_id: itemId,
          source_url: link ? normalizeUrl(link, TRUECAR_CONFIG.baseUrl) : "",
          title,
          year,
          make,
          model,
          vin: vinText,
          ask_price: price,
          mileage: extractMileage(mileageText),
          condition: "clean",
          location_city: locationText.split(",")[0]?.trim() || locationText,
          location_state: locationText.split(",")[1]?.trim() || "",
          images: imgSrc ? [imgSrc] : [],
          seller_type: "dealer",
          seller: dealerText || "TrueCar",
          metadata: {
            market_value: marketValue || undefined,
            savings_vs_market: savingsVsMarket || undefined,
            certified: isCertified,
          },
          scraped_at: new Date().toISOString(),
        });
      });

      const hasMore =
        $('button[aria-label="Next"], .pagination-next, [data-test="nextPage"]')
          .length > 0;
      return { items, hasMore };
    },
  );

  for await (const batch of gen) {
    allDeals.push(...batch);
  }

  console.log(`[TrueCar] Found ${allDeals.length} deals`);

  if (allDeals.length > 0) {
    await upsertDeals(allDeals);
  }

  return allDeals.length;
}
