// lib/scrapers/sources/iseecars.ts
// ─── iSeeCars — deal-scored aggregator with underpriced inventory signals ─────
// iSeeCars runs its own price analysis on listings. Their "great deal" and
// "good deal" badges are strong signals for underpriced inventory.

import type { Deal } from "@/types";
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const ISEECARS_CONFIG: ScraperConfig = {
  name: "iSeeCars",
  baseUrl: "https://www.iseecars.com",
  renderMode: "adaptive",
  requestDelay: 2000,
  concurrency: 2,
  useProxies: false,
  stealth: false,
  maxPages: 15,
};

export async function scrapeISeeCars(): Promise<number> {
  console.log("[iSeeCars] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  // Focus on "great deal" filter — these are already flagged as underpriced
  const gen = paginate<Partial<Deal>>(
    ISEECARS_CONFIG,
    (page) => `https://www.iseecars.com/used-cars-for-sale#t=results&deal=great-deal&page=${page}`,
    async (rawInput) => {
      const html = typeof rawInput === "string" ? rawInput : "";
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);
      const items: Partial<Deal>[] = [];

      $(".vehicle-card, .car-listing, [class*='VehicleCard'], [class*='CarCard']").each((_, el) => {
        const card = $(el);
        const title = card.find("h2, h3, .vehicle-title, [class*='title']").first().text().trim();
        if (!title) return;

        const priceText = card.find(".price, [class*='price']").first().text();
        const price = extractPrice(priceText);
        if (!price) return;

        const link = card.find("a").first().attr("href");
        const id = link?.split("/").filter(Boolean).pop()?.split("?")[0] || "";
        if (!id || seen.has(id)) return;
        seen.add(id);

        const imgSrc = card.find("img").first().attr("src");
        const mileText = card.find("[class*='mileage'], [class*='miles']").first().text();
        const locationText = card.find("[class*='location'], [class*='city']").first().text().trim();
        const parts = locationText.split(",").map(s => s.trim());

        // iSeeCars deal badge — great/good deal = already underpriced by their model
        const dealBadge = card.find("[class*='deal-badge'], [class*='DealBadge']").first().text().trim().toLowerCase();
        const savingsText = card.find("[class*='savings'], [class*='below-market']").first().text();
        const savings = extractPrice(savingsText);

        const year = extractYear(title);
        const titleParts = title.split(" ");

        items.push({
          source: "iseecars",
          source_deal_id: id,
          source_url: link ? normalizeUrl(link, ISEECARS_CONFIG.baseUrl) : "",
          title,
          year,
          make: titleParts[year ? 1 : 0] || "",
          model: titleParts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "",
          ask_price: price,
          mileage: extractMileage(mileText),
          condition: "clean",
          seller_type: "dealer",
          location_city: parts[0] || "",
          location_state: parts[1] || "",
          images: imgSrc ? [imgSrc] : [],
          metadata: {
            deal_badge: dealBadge || null,
            savings_vs_market: savings || null,
            pre_scored: true,
          },
        });
      });

      const hasMore = $("a[rel='next'], .pagination-next, [aria-label='Next']").length > 0 && items.length > 0;
      return { items, hasMore };
    },
  );

  for await (const batch of gen) allDeals.push(...batch);

  console.log(`[iSeeCars] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
