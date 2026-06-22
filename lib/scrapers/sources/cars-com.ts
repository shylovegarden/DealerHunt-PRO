import * as cheerio from "cheerio";
import {
  fetchHtml,
  paginate,
  extractPrice,
  extractMileage,
  extractYear,
  normalizeUrl,
  type ScraperConfig,
} from "../engine";
import { enrichAndStore } from "./shared";
import { STATE_SEED_ZIPS, US_STATES } from "@/lib/geo";

export const CARS_COM_CONFIG: ScraperConfig = {
  name: "Cars.com",
  baseUrl: "https://www.cars.com",
  renderMode: "static",
  requestDelay: 1200,
  concurrency: 4,
  useProxies: true,
  stealth: false,
  maxPages: 10,
};

export async function scrapeCarsCom(
  searchTerm = "",
  state = "tx",
  maxPages = 5,
) {
  console.log("[Cars.com] Starting scrape...");
  const all: any[] = [];

  const gen = paginate<any>(
    CARS_COM_CONFIG,
    (page) => {
      const q = searchTerm
        ? `&searchTerm=${encodeURIComponent(searchTerm)}`
        : "";
      const zip = STATE_SEED_ZIPS[state?.toUpperCase()] || "";
      const st = zip ? `&stockType=used&maximum_distance=100&zip=${zip}` : "";
      return `https://www.cars.com/shopping/results/?page=${page}${q}${st}&sort=best_match_desc`;
    },
    async (input) => {
      const $ = typeof input === "string" ? cheerio.load(input) : input;
      const items: any[] = [];

      $(".vehicle-card, .car-card, [data-vehicle-id]").each((_, el) => {
        const row = $(el);
        const title =
          row.find(".title, h2, .vehicle-card__title").first().text().trim() ||
          row.find("a").first().attr("title") ||
          "";
        if (!title) return;

        const priceText = row
          .find('.price, .vehicle-card__price, [class*="price"]')
          .first()
          .text()
          .trim();
        const price = extractPrice(priceText) || 0;
        if (!price) return;

        const mileText = row
          .find('.mileage, .odometer, [class*="mile"]')
          .first()
          .text()
          .trim();
        const href =
          row.find("a").first().attr("href") ||
          row.find('a[href*="/vehicledetail"]').attr("href") ||
          "";
        const img =
          row.find("img").first().attr("src") ||
          row.find("img").attr("data-src") ||
          "";
        const dealer = row
          .find('.dealer-name, .seller-name, [class*="dealer"]')
          .first()
          .text()
          .trim();
        const loc = row
          .find('.dealer-location, .location, [class*="location"]')
          .first()
          .text()
          .trim();

        items.push({
          source: "cars_com",
          source_category: "retail",
          external_id:
            href.match(/\/(\d+)\//)?.[1] ||
            href.split("/").pop()?.replace(".html", "") ||
            "",
          listing_url: href.startsWith("http")
            ? href
            : `https://www.cars.com${href}`,
          title,
          year: extractYear(title),
          make: title.split(" ")[1] || "",
          model: title.split(" ").slice(2, 4).join(" "),
          asking_price: price,
          odometer: extractMileage(mileText) || 0,
          condition: "used",
          location_city: loc.split(",")[0]?.trim(),
          location_state: loc.split(",")[1]?.trim() || state?.toUpperCase(),
          images: img ? [img] : [],
          seller: dealer,
          seller_type: "dealer",
        });
      });

      const hasMore =
        $('.next-page, [aria-label="Next"], .pagination-next').length > 0;
      return { items, hasMore };
    },
  );

  for await (const batch of gen) {
    for (const v of batch) {
      await enrichAndStore(v);
      all.push(v);
    }
    if (all.length >= maxPages * 20) break;
  }

  console.log(`[Cars.com] Found ${all.length} listings`);
  return all.length;
}

// Nationwide Cars.com: iterate one seed ZIP per state (radius 100mi). Override the state set
// with CARS_STATES env (comma-separated); cap pages/state with CARS_MAX_PAGES.
export async function scrapeCarsComAllStates(searchTerm = ""): Promise<number> {
  const fromEnv = process.env.CARS_STATES?.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const states = fromEnv?.length ? fromEnv : [...US_STATES];
  const maxPages = parseInt(process.env.CARS_MAX_PAGES || "3");
  let total = 0;
  for (const state of states) {
    try {
      total += await scrapeCarsCom(searchTerm, state, maxPages);
    } catch (e) {
      console.error(`[Cars.com] ${state} failed:`, (e as Error).message);
    }
  }
  console.log(
    `[Cars.com] Nationwide total: ${total} listings across ${states.length} states`,
  );
  return total;
}
