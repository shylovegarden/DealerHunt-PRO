// lib/scrapers/sources/offerup.ts
// ─── OfferUp scraper - Mobile-first local marketplace ─────────────────────────

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

export const OFFERUP_CONFIG: ScraperConfig = {
  name: "OfferUp",
  baseUrl: "https://offerup.com",
  renderMode: "browser", // Mobile-optimized React app
  requestDelay: 3000,
  concurrency: 1,
  useProxies: true,
  stealth: true,
  maxPages: 10,
  headers: {
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  },
};

export async function scrapeOfferUp(
  searchTerm = "car",
  location = "dallas-tx",
  maxPages = OFFERUP_CONFIG.maxPages,
) {
  console.log(
    `[OfferUp] Starting scrape for "${searchTerm}" in ${location}...`,
  );
  const allDeals: Partial<Deal>[] = [];

  const config = { ...OFFERUP_CONFIG, maxPages };
  const gen = paginate<Partial<Deal>>(
    config,
    (page) => {
      const baseUrl = `https://offerup.com/search`;
      const params = new URLSearchParams({
        q: searchTerm,
        location,
        page: String(page),
      });
      return `${baseUrl}?${params.toString()}`;
    },
    async (input) => {
      const $ = typeof input === "string" ? cheerio.load(input) : input;
      const items: Partial<Deal>[] = [];

      // OfferUp uses specific data attributes
      $('[data-testid="item-card"], .item-card, .listing-card').each(
        (_: number, el: any) => {
          const row = $(el);

          // Extract title
          const title = row
            .find('[data-testid="item-title"], .item-title, h3')
            .text()
            .trim();
          if (!title) return;

          // Filter for vehicles only
          if (!title.match(/\d{4}/)) return; // Must have year
          if (title.length < 10) return; // Too short to be vehicle listing

          // Extract price
          const priceText = row
            .find('[data-testid="item-price"], .item-price, .price')
            .text()
            .trim();
          const price = extractPrice(priceText);
          if (!price || price < 500) return; // Skip non-vehicle items

          // Extract location
          const locationText = row
            .find('[data-testid="item-location"], .item-location, .location')
            .text()
            .trim();

          // Extract seller
          const sellerText = row
            .find('[data-testid="seller-name"], .seller-name')
            .text()
            .trim();

          // Extract link
          const link =
            row.find('a[href*="/item/"]').attr("href") ||
            row.find("a").first().attr("href");

          // Extract image
          const imgSrc =
            row
              .find('img[data-testid="item-image"], img')
              .first()
              .attr("src") || row.find("img").first().attr("data-src");

          // Extract item ID
          const itemId = link?.match(/\/item\/([^\/]+)/)?.[1] || "";

          // Parse year/make/model
          const titleParts = title.split(" ");
          const year = extractYear(title);
          const make = titleParts[year ? 1 : 0] || "";
          const model =
            titleParts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "";

          // Extract mileage from title (often included)
          const mileageMatch = title.match(
            /(\d{1,3}[,\.]?\d{3})\s*(mi|miles|k)/i,
          );
          let mileage = 0;
          if (mileageMatch) {
            const mileageStr = mileageMatch[1].replace(/[,\.]/g, "");
            mileage = parseInt(mileageStr);
            if (title.toLowerCase().includes("k")) {
              mileage *= 1000;
            }
          }

          items.push({
            source: "offerup",
            source_deal_id: itemId,
            source_url: link ? normalizeUrl(link, OFFERUP_CONFIG.baseUrl) : "",
            title,
            year,
            make,
            model,
            ask_price: price,
            mileage,
            condition: title.toLowerCase().includes("salvage")
              ? "salvage"
              : "clean",
            location_city: locationText.split(",")[0]?.trim() || locationText,
            location_state: locationText.split(",")[1]?.trim() || "",
            images: imgSrc ? [imgSrc] : [],
            seller_type: "private",
            seller: sellerText || "OfferUp Seller",
            metadata: {
              negotiable: true,
              local_pickup: true,
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

  console.log(`[OfferUp] Found ${allDeals.length} deals`);

  if (allDeals.length > 0) {
    await upsertDeals(allDeals);
  }

  return allDeals.length;
}
