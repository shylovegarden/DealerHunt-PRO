// lib/scrapers/sources/mecum.ts
// ─── Mecum Auctions — major collector/muscle car auctions ────────────────────

import type { Deal } from "@/types";
import { paginate, extractPrice, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const MECUM_CONFIG: ScraperConfig = {
  name: "Mecum",
  baseUrl: "https://www.mecum.com",
  renderMode: "adaptive",
  requestDelay: 2500,
  concurrency: 2,
  useProxies: false,
  stealth: false,
  maxPages: 20,
};

export async function scrapeMecum(): Promise<number> {
  console.log("[Mecum] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  const gen = paginate<Partial<Deal>>(
    MECUM_CONFIG,
    (page) => `https://www.mecum.com/lots/?page=${page}&category=car`,
    async (rawInput) => {
      const html = typeof rawInput === "string" ? rawInput : "";
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);
      const items: Partial<Deal>[] = [];

      $(".lot-card, .listing-item, [class*='LotCard']").each((_, el) => {
        const card = $(el);
        const title = card.find(".lot-title, h3, h2").first().text().trim();
        if (!title) return;

        const priceText = card.find(".high-bid, .price, .sold-price").first().text();
        const price = extractPrice(priceText);

        const link = card.find("a[href*='/lots/']").first().attr("href");
        const id = link?.split("/").filter(Boolean).pop() || "";
        if (!id || seen.has(id)) return;
        seen.add(id);

        const imgSrc = card.find("img").first().attr("src") || card.find("img").first().attr("data-src");
        const locationText = card.find(".location, .auction-location").first().text().trim();
        const auctionDate = card.find(".auction-date, .date").first().text().trim();
        const isActive = !card.find(".sold-badge, .sold").length;

        items.push({
          source: "mecum",
          source_deal_id: id,
          source_url: link ? normalizeUrl(link, MECUM_CONFIG.baseUrl) : "",
          title,
          year: extractYear(title),
          make: title.split(" ")[1] || "",
          model: title.split(" ").slice(2, 4).join(" ") || "",
          ask_price: price || 0,
          condition: "collectible",
          seller_type: "auction",
          seller: "Mecum Auctions",
          location_city: locationText.split(",")[0]?.trim() || "",
          location_state: locationText.split(",")[1]?.trim() || "",
          images: imgSrc ? [imgSrc] : [],
          auction_end: auctionDate ? new Date(auctionDate).toISOString() : null,
          metadata: { auction_house: "Mecum", collectible: true, is_active: isActive },
        });
      });

      const hasMore = $(".pagination .next, [aria-label='Next page']").length > 0 && items.length > 0;
      return { items, hasMore };
    },
  );

  for await (const batch of gen) allDeals.push(...batch);

  console.log(`[Mecum] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
