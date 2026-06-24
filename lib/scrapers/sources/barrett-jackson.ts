// lib/scrapers/sources/barrett-jackson.ts
// ─── Barrett-Jackson — premier collector car auction house ───────────────────
// High-end collector/exotic auctions. Top-tier price discovery for rare vehicles.

import type { Deal } from "@/types";
import { paginate, extractPrice, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const BARRETT_JACKSON_CONFIG: ScraperConfig = {
  name: "Barrett-Jackson",
  baseUrl: "https://www.barrett-jackson.com",
  renderMode: "adaptive",
  requestDelay: 2500,
  concurrency: 1,
  useProxies: false,
  stealth: false,
  maxPages: 20,
};

export async function scrapeBarrettJackson(): Promise<number> {
  console.log("[Barrett-Jackson] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  const gen = paginate<Partial<Deal>>(
    BARRETT_JACKSON_CONFIG,
    (page) => `https://www.barrett-jackson.com/Events/All-Events/Lots?page=${page}&category=automobile`,
    async (rawInput) => {
      const html = typeof rawInput === "string" ? rawInput : "";
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);
      const items: Partial<Deal>[] = [];

      $(".lot-listing, .vehicle-lot, [class*='LotCard'], article.lot").each((_, el) => {
        const card = $(el);
        const title = card.find("h2, h3, .lot-title, [class*='LotTitle']").first().text().trim();
        if (!title) return;

        const priceText = card.find(".sold-price, .high-bid, .estimate, [class*='price']").first().text();
        const price = extractPrice(priceText);

        const link = card.find("a").first().attr("href");
        const id = link?.split("/").filter(Boolean).pop()?.split("?")[0] || "";
        if (!id || seen.has(id)) return;
        seen.add(id);

        const imgSrc = card.find("img").first().attr("src") || card.find("img").first().attr("data-src");
        const lotNumber = card.find(".lot-number, [class*='LotNumber']").first().text().trim();
        const auctionDate = card.find(".auction-date, .date, [class*='Date']").first().text().trim();
        const isSold = card.find(".sold, .sold-badge").length > 0;

        const year = extractYear(title);
        const parts = title.split(" ");

        items.push({
          source: "barrett_jackson",
          source_deal_id: id,
          source_url: link ? normalizeUrl(link, BARRETT_JACKSON_CONFIG.baseUrl) : "",
          title,
          year,
          make: parts[year ? 1 : 0] || "",
          model: parts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "",
          ask_price: price || 0,
          condition: "collectible",
          seller_type: "auction",
          seller: "Barrett-Jackson",
          auction_end: auctionDate ? new Date(auctionDate).toISOString() : null,
          images: imgSrc ? [imgSrc] : [],
          metadata: {
            auction_house: "Barrett-Jackson",
            lot_number: lotNumber,
            is_sold: isSold,
            collectible: true,
            high_end: true,
          },
        });
      });

      const hasMore = $("a[rel='next'], .pagination-next, [aria-label='Next']").length > 0 && items.length > 0;
      return { items, hasMore };
    },
  );

  for await (const batch of gen) allDeals.push(...batch);

  console.log(`[Barrett-Jackson] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
