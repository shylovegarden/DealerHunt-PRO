// lib/scrapers/sources/carsdirect.ts
// ─── CarsDirect — dealer network listings aggregator ─────────────────────────
// CarsDirect aggregates inventory from thousands of dealerships nationwide.
// Good source for new + CPO inventory comps.

import type { Deal } from "@/types";
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const CARSDIRECT_CONFIG: ScraperConfig = {
  name: "CarsDirect",
  baseUrl: "https://www.carsdirect.com",
  renderMode: "adaptive",
  requestDelay: 2000,
  concurrency: 2,
  useProxies: true,
  stealth: true,
  maxPages: 15,
};

const COVERAGE_ZIPS = ["10001", "90001", "60601", "77001", "85001", "78701", "98101", "30301"];

export async function scrapeCarsDirect(): Promise<number> {
  console.log("[CarsDirect] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  for (const zip of COVERAGE_ZIPS) {
    const gen = paginate<Partial<Deal>>(
      CARSDIRECT_CONFIG,
      (page) => `https://www.carsdirect.com/used-cars-for-sale?zip=${zip}&page=${page}`,
      async (rawInput) => {
        const html = typeof rawInput === "string" ? rawInput : "";
        const cheerio = await import("cheerio");
        const $ = cheerio.load(html);
        const items: Partial<Deal>[] = [];

        $(".vehicle-card, .listing-card, [class*='VehicleCard'], [data-qa='vehicle-card']").each((_, el) => {
          const card = $(el);
          const title = card.find("h2, h3, [data-qa='vehicle-title'], [class*='title']").first().text().trim();
          if (!title) return;

          const priceText = card.find("[data-qa='price'], [class*='price']").first().text();
          const price = extractPrice(priceText);
          if (!price) return;

          const link = card.find("a").first().attr("href");
          const vin = link?.match(/\/([A-HJ-NPR-Z0-9]{17})/i)?.[1] || "";
          const id = vin || link?.split("/").filter(Boolean).pop()?.split("?")[0] || "";
          if (!id || seen.has(id)) return;
          seen.add(id);

          const imgSrc = card.find("img").first().attr("src") || card.find("img").first().attr("data-src");
          const mileText = card.find("[class*='mileage'], [class*='miles']").first().text();
          const dealerName = card.find("[class*='dealer'], [class*='seller']").first().text().trim();
          const locationText = card.find("[class*='location'], [class*='city']").first().text().trim();
          const parts = locationText.split(",").map(s => s.trim());

          const year = extractYear(title);
          const titleParts = title.split(" ");
          const isCpo = card.find("[class*='certified'], [class*='CPO']").length > 0;

          items.push({
            source: "carsdirect",
            source_deal_id: id,
            source_url: link ? normalizeUrl(link, CARSDIRECT_CONFIG.baseUrl) : "",
            title,
            year,
            make: titleParts[year ? 1 : 0] || "",
            model: titleParts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "",
            vin: vin || undefined,
            ask_price: price,
            mileage: extractMileage(mileText),
            condition: isCpo ? "certified" : "clean",
            seller_type: "dealer",
            seller: dealerName || "Dealer",
            location_city: parts[0] || "",
            location_state: parts[1] || "",
            images: imgSrc ? [imgSrc] : [],
            metadata: { certified: isCpo },
          });
        });

        const hasMore = $("a[rel='next'], [aria-label='Next page']").length > 0 && items.length > 0;
        return { items, hasMore };
      },
    );
    for await (const batch of gen) allDeals.push(...batch);
  }

  console.log(`[CarsDirect] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
