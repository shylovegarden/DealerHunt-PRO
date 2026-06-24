// lib/scrapers/sources/autotempest.ts
// ─── AutoTempest — meta-aggregator (Craigslist + Cars.com + more) ─────────────
// AutoTempest aggregates listings from Craigslist, Cars.com, eBay, CarGurus,
// and others into one search. Surfaces deals our direct CL scraper misses
// (different city coverage, categories, or timing).

import type { Deal } from "@/types";
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const AUTOTEMPEST_CONFIG: ScraperConfig = {
  name: "AutoTempest",
  baseUrl: "https://www.autotempest.com",
  renderMode: "static",
  requestDelay: 2000,
  concurrency: 2,
  useProxies: false,
  stealth: false,
  maxPages: 10,
};

const SEARCH_QUERIES = [
  { make: "ford", model: "f-150" },
  { make: "chevrolet", model: "silverado" },
  { make: "toyota", model: "tacoma" },
  { make: "honda", model: "civic" },
  { make: "toyota", model: "camry" },
  { make: "jeep", model: "wrangler" },
  { make: "bmw", model: "3-series" },
  { make: "mercedes-benz", model: "c-class" },
];

export async function scrapeAutoTempest(): Promise<number> {
  console.log("[AutoTempest] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  for (const { make, model } of SEARCH_QUERIES) {
    const gen = paginate<Partial<Deal>>(
      AUTOTEMPEST_CONFIG,
      (page) => `https://www.autotempest.com/results?make=${make}&model=${model}&zip=90001&radius=unlimited&minyear=2000&page=${page}`,
      async (rawInput) => {
        const html = typeof rawInput === "string" ? rawInput : "";
        const cheerio = await import("cheerio");
        const $ = cheerio.load(html);
        const items: Partial<Deal>[] = [];

        $(".result-list-item, .listing-item, [class*='ResultItem']").each((_, el) => {
          const card = $(el);
          const title = card.find("h3, h2, .listing-title, [class*='title']").first().text().trim();
          if (!title) return;

          const priceText = card.find(".price, [class*='price']").first().text();
          const price = extractPrice(priceText);
          if (!price) return;

          // AutoTempest links out to source — capture source URL for dedup
          const externalLink = card.find("a[href*='craigslist'], a[href*='cars.com'], a[href*='ebay'], a[href*='cargurus']").first().attr("href")
            || card.find("a[href^='http']").first().attr("href");
          const internalLink = card.find("a").first().attr("href");
          const sourceUrl = externalLink || internalLink || "";

          const id = sourceUrl.split("/").filter(Boolean).pop()?.split("?")[0]
            || `at-${make}-${model}-${title.slice(0, 30).replace(/\s+/g, "-")}`;
          if (!id || seen.has(id)) return;
          seen.add(id);

          const imgSrc = card.find("img").first().attr("src");
          const mileText = card.find("[class*='mileage'], [class*='miles']").first().text();
          const locationText = card.find("[class*='location'], [class*='city']").first().text().trim();
          const parts = locationText.split(",").map(s => s.trim());
          const year = extractYear(title);
          const titleParts = title.split(" ");

          // Tag source so we don't double-count with direct scrapers
          const originSource = sourceUrl.includes("craigslist") ? "craigslist"
            : sourceUrl.includes("cars.com") ? "cars_com"
            : sourceUrl.includes("cargurus") ? "cargurus"
            : "autotempest";

          items.push({
            source: "autotempest",
            source_deal_id: id,
            source_url: sourceUrl,
            title,
            year,
            make: titleParts[year ? 1 : 0] || make,
            model: titleParts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || model,
            ask_price: price,
            mileage: extractMileage(mileText),
            condition: "run_drive",
            location_city: parts[0] || "",
            location_state: parts[1] || "",
            images: imgSrc ? [imgSrc] : [],
            metadata: { aggregated_from: originSource },
          });
        });

        const hasMore = $("a[rel='next'], .next-page, [aria-label='Next']").length > 0 && items.length > 0;
        return { items, hasMore };
      },
    );
    for await (const batch of gen) allDeals.push(...batch);
  }

  console.log(`[AutoTempest] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
