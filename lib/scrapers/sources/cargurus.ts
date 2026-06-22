// lib/scrapers/sources/cargurus.ts
// ─── CarGurus scraper - Deal ratings and price analysis ───────────────────────

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

export const CARGURUS_CONFIG: ScraperConfig = {
  name: "CarGurus",
  baseUrl: "https://www.cargurus.com",
  renderMode: "browser", // React SPA
  requestDelay: 3500,
  concurrency: 1,
  useProxies: true,
  stealth: true,
  maxPages: 12,
  headers: {
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
};

export async function scrapeCarGurus(
  searchTerm = "",
  zip = "75201",
  maxPages = CARGURUS_CONFIG.maxPages,
) {
  console.log(`[CarGurus] Starting scrape for "${searchTerm}" near ${zip}...`);
  const allDeals: Partial<Deal>[] = [];

  const config = { ...CARGURUS_CONFIG, maxPages };
  const gen = paginate<Partial<Deal>>(
    config,
    (page) => {
      const baseUrl =
        "https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action";
      const params = new URLSearchParams({
        zip,
        distance: "500",
        ...(searchTerm && { searchTerm }),
        startYear: "2010",
        offset: String((page - 1) * 15),
      });
      return `${baseUrl}?${params.toString()}`;
    },
    async (input) => {
      const $ = typeof input === "string" ? cheerio.load(input) : input;
      const items: Partial<Deal>[] = [];

      // CarGurus uses specific data attributes
      $(
        '[data-testid="listing-card"], .listing-row, .cg-dealFinder-result',
      ).each((_: number, el: any) => {
        const row = $(el);

        // Extract title
        const title = row
          .find('[data-testid="listing-title"], h4, .listing-title')
          .text()
          .trim();
        if (!title) return;

        // Extract price
        const priceText = row
          .find('[data-testid="listing-price"], .price-section, .listing-price')
          .text()
          .trim();
        const price = extractPrice(priceText);
        if (!price) return;

        // Extract deal rating (CarGurus specialty)
        const dealRating = row
          .find('[data-testid="deal-rating"], .deal-badge, .deal-rating')
          .text()
          .trim()
          .toLowerCase();

        // Extract mileage
        const mileageText = row
          .find('[data-testid="listing-mileage"], .mileage, .listing-mileage')
          .text()
          .trim();

        // Extract location
        const locationText = row
          .find('[data-testid="dealer-location"], .dealer-distance, .location')
          .text()
          .trim();

        // Extract dealer
        const dealerText = row
          .find('[data-testid="dealer-name"], .dealer-name')
          .text()
          .trim();

        // Extract link
        const link =
          row.find('a[href*="/Cars/"]').attr("href") ||
          row.find("a").first().attr("href");

        // Extract image
        const imgSrc =
          row
            .find('img[data-testid="listing-image"], img')
            .first()
            .attr("src") || row.find("img").first().attr("data-src");

        // Extract listing ID
        const listingId =
          link?.match(/\/(\d+)$/)?.[1] ||
          link?.match(/listingId=(\d+)/)?.[1] ||
          "";

        // Parse year/make/model
        const titleParts = title.split(" ");
        const year = extractYear(title);
        const make = titleParts[year ? 1 : 0] || "";
        const model =
          titleParts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "";

        // Calculate bonus score based on deal rating
        let dealScore = 0;
        if (dealRating.includes("great")) dealScore = 15;
        else if (dealRating.includes("good")) dealScore = 10;
        else if (dealRating.includes("fair")) dealScore = 5;

        items.push({
          source: "cargurus",
          source_deal_id: listingId,
          source_url: link ? normalizeUrl(link, CARGURUS_CONFIG.baseUrl) : "",
          title,
          year,
          make,
          model,
          ask_price: price,
          mileage: extractMileage(mileageText),
          condition: "clean",
          location_city: locationText.split(",")[0]?.trim() || locationText,
          location_state: locationText.split(",")[1]?.trim() || "",
          images: imgSrc ? [imgSrc] : [],
          seller_type: "dealer",
          seller: dealerText || "CarGurus",
          metadata: {
            deal_rating: dealRating || undefined,
            deal_score: dealScore,
          },
          scraped_at: new Date().toISOString(),
        });
      });

      const hasMore =
        $(
          'button[aria-label="Next"], .pagination-next, [data-testid="next-page"]',
        ).length > 0;
      return { items, hasMore };
    },
  );

  for await (const batch of gen) {
    allDeals.push(...batch);
  }

  console.log(`[CarGurus] Found ${allDeals.length} deals`);

  if (allDeals.length > 0) {
    await upsertDeals(allDeals);
  }

  return allDeals.length;
}
