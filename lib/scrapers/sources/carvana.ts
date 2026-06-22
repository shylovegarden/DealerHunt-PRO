// lib/scrapers/sources/carvana.ts
// ─── Carvana scraper - Online-only dealer with nationwide delivery ────────────

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

export const CARVANA_CONFIG: ScraperConfig = {
  name: "Carvana",
  baseUrl: "https://www.carvana.com",
  renderMode: "browser", // GraphQL API + React
  requestDelay: 3000,
  concurrency: 1,
  useProxies: true,
  stealth: true,
  maxPages: 10,
  headers: {
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
};

export async function scrapeCarvana(
  searchTerm = "",
  maxPages = CARVANA_CONFIG.maxPages,
) {
  console.log(`[Carvana] Starting scrape for "${searchTerm}"...`);
  const allDeals: Partial<Deal>[] = [];

  const config = { ...CARVANA_CONFIG, maxPages };
  const gen = paginate<Partial<Deal>>(
    config,
    (page) => {
      const baseUrl = "https://www.carvana.com/cars";
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        page: String(page),
      });
      return `${baseUrl}?${params.toString()}`;
    },
    async (input) => {
      const $ = typeof input === "string" ? cheerio.load(input) : input;
      const items: Partial<Deal>[] = [];

      // Carvana uses specific class names and data attributes
      $('[data-testid="result-tile"], .result-tile, .vehicle-card').each(
        (_: number, el: any) => {
          const row = $(el);

          // Extract title
          const title = row
            .find('[data-testid="vehicle-year-make-model"], .vehicle-title, h3')
            .text()
            .trim();
          if (!title) return;

          // Extract price
          const priceText = row
            .find('[data-testid="vehicle-price"], .price, .vehicle-price')
            .text()
            .trim();
          const price = extractPrice(priceText);
          if (!price) return;

          // Extract mileage
          const mileageText = row
            .find('[data-testid="vehicle-mileage"], .mileage, .vehicle-mileage')
            .text()
            .trim();

          // Extract trim/features
          const trimText = row
            .find('[data-testid="vehicle-trim"], .trim, .vehicle-trim')
            .text()
            .trim();

          // Extract link
          const link =
            row.find('a[href*="/vehicle/"]').attr("href") ||
            row.find("a").first().attr("href");

          // Extract image
          const imgSrc =
            row
              .find('img[data-testid="vehicle-image"], img')
              .first()
              .attr("src") || row.find("img").first().attr("data-src");

          // Extract vehicle ID
          const vehicleId = link?.match(/\/vehicle\/(\d+)/)?.[1] || "";

          // Parse year/make/model
          const titleParts = title.split(" ");
          const year = extractYear(title);
          const make = titleParts[year ? 1 : 0] || "";
          const model =
            titleParts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "";

          items.push({
            source: "carvana",
            source_deal_id: vehicleId,
            source_url: link ? normalizeUrl(link, CARVANA_CONFIG.baseUrl) : "",
            title,
            year,
            make,
            model,
            trim: trimText,
            ask_price: price,
            mileage: extractMileage(mileageText),
            condition: "clean", // Carvana only sells clean title
            images: imgSrc ? [imgSrc] : [],
            seller_type: "dealer",
            seller: "Carvana",
            metadata: {
              delivery_available: true,
              seven_day_return: true,
            },
            scraped_at: new Date().toISOString(),
          });
        },
      );

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

  console.log(`[Carvana] Found ${allDeals.length} deals`);

  if (allDeals.length > 0) {
    await upsertDeals(allDeals);
  }

  return allDeals.length;
}
