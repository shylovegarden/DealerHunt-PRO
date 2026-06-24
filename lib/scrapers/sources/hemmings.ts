// lib/scrapers/sources/hemmings.ts
// ─── Hemmings — classic and collector car marketplace ─────────────────────────

import type { Deal } from "@/types";
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const HEMMINGS_CONFIG: ScraperConfig = {
  name: "Hemmings",
  baseUrl: "https://www.hemmings.com",
  renderMode: "adaptive",
  requestDelay: 2000,
  concurrency: 2,
  useProxies: false,
  stealth: false,
  maxPages: 20,
};

export async function scrapeHemmings(): Promise<number> {
  console.log("[Hemmings] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  const gen = paginate<Partial<Deal>>(
    HEMMINGS_CONFIG,
    (page) => `https://www.hemmings.com/classifieds/cars-for-sale?pageNum=${page}`,
    async (rawInput) => {
      const html = typeof rawInput === "string" ? rawInput : "";
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);
      const items: Partial<Deal>[] = [];

      $(".listing-card, [class*='ListingCard'], article.listing").each((_, el) => {
        const card = $(el);
        const title = card.find("h2, h3, .listing-title, [class*='title']").first().text().trim();
        if (!title) return;

        const priceText = card.find(".price, [class*='price']").first().text();
        const price = extractPrice(priceText);

        const link = card.find("a").first().attr("href");
        const id = link?.split("/").filter(Boolean).pop()?.split("?")[0] || "";
        if (!id || seen.has(id)) return;
        seen.add(id);

        const imgSrc = card.find("img").first().attr("src") || card.find("img").first().attr("data-src");
        const mileageText = card.find(".mileage, [class*='mileage'], [class*='miles']").first().text();
        const locationText = card.find(".location, [class*='location']").first().text().trim();
        const parts = locationText.split(",").map(s => s.trim());

        items.push({
          source: "hemmings",
          source_deal_id: id,
          source_url: link ? normalizeUrl(link, HEMMINGS_CONFIG.baseUrl) : "",
          title,
          year: extractYear(title),
          make: title.split(" ")[1] || "",
          model: title.split(" ").slice(2, 4).join(" ") || "",
          ask_price: price || 0,
          mileage: extractMileage(mileageText),
          condition: "collectible",
          seller_type: "private",
          location_city: parts[0] || "",
          location_state: parts[1] || "",
          images: imgSrc ? [imgSrc] : [],
          metadata: { collectible: true, source_type: "classic_marketplace" },
        });
      });

      const hasMore = $("a[rel='next'], .pagination-next, [aria-label='Next']").length > 0 && items.length > 0;
      return { items, hasMore };
    },
  );

  for await (const batch of gen) allDeals.push(...batch);

  console.log(`[Hemmings] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
