// lib/scrapers/sources/govplanet.ts
// ─── GovPlanet — government surplus vehicle auctions ─────────────────────────
// Heavy equipment + vehicles auctioned off by US federal/state agencies.
// Often massively underpriced vs retail. All listings are public, no auth needed.

import type { Deal } from "@/types";
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const GOVPLANET_CONFIG: ScraperConfig = {
  name: "GovPlanet",
  baseUrl: "https://www.govplanet.com",
  renderMode: "adaptive",
  requestDelay: 2000,
  concurrency: 2,
  useProxies: false,
  stealth: false,
  maxPages: 15,
  headers: { "Accept-Language": "en-US,en;q=0.9" },
};

const SEARCH_QUERIES = [
  "pickup+truck", "sedan", "SUV", "van", "jeep", "ford", "chevrolet", "dodge", "toyota"
];

export async function scrapeGovPlanet(): Promise<number> {
  console.log("[GovPlanet] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  for (const query of SEARCH_QUERIES) {
    const gen = paginate<Partial<Deal>>(
      GOVPLANET_CONFIG,
      (page) => `https://www.govplanet.com/for-sale/Trucks-and-Passenger-Vehicles/${query}/usa?Nrpp=96&No=${(page - 1) * 96}`,
      async (rawInput) => {
        const html = typeof rawInput === "string" ? rawInput : "";
        const cheerio = await import("cheerio");
        const $ = cheerio.load(html);
        const items: Partial<Deal>[] = [];

        $(".item-listing, .lot-card, [class*='ItemListing']").each((_, el) => {
          const card = $(el);
          const title = card.find(".listing-title, h3, .item-title").first().text().trim();
          if (!title) return;

          const priceText = card.find(".price, .current-bid, [class*='price']").first().text();
          const price = extractPrice(priceText);

          const link = card.find("a[href*='/for-sale/']").first().attr("href");
          const id = link?.split("/").filter(Boolean).pop() || "";
          if (!id || seen.has(id)) return;
          seen.add(id);

          const imgSrc = card.find("img").first().attr("src") || card.find("img").first().attr("data-src");
          const locationText = card.find(".location, [class*='location']").first().text().trim();
          const parts = locationText.split(",").map(s => s.trim());

          // Parse year/make/model from title like "2019 Ford F-250 Super Duty"
          // title.split(" ") = ["2019", "Ford", "F-250", "Super", "Duty"]
          const titleYear = extractYear(title);
          const titleWords = title.replace(/^\d{4}\s*/, "").trim().split(/\s+/);
          const titleMake = titleWords[0] || "";
          const titleModel = titleWords.slice(1, 3).join(" ") || "";

          items.push({
            source: "govplanet",
            source_deal_id: id,
            source_url: link ? normalizeUrl(link, GOVPLANET_CONFIG.baseUrl) : "",
            title,
            year: titleYear,
            make: titleMake,
            model: titleModel,
            ask_price: price || 0,
            mileage: extractMileage(title),
            condition: "government_surplus",
            seller_type: "government",
            seller: "GovPlanet",
            location_city: parts[0] || "",
            location_state: parts[1] || "",
            images: imgSrc ? [imgSrc] : [],
            metadata: { auction_type: "government_surplus" },
          });
        });

        const hasMore = $(".next, [aria-label='Next']").length > 0 && items.length > 0;
        return { items, hasMore };
      },
    );
    for await (const batch of gen) allDeals.push(...batch);
  }

  console.log(`[GovPlanet] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
