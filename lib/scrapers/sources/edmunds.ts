// lib/scrapers/sources/edmunds.ts
// ─── Edmunds — trusted automotive marketplace + pricing benchmark ─────────────
// Edmunds has both a listings marketplace and market-value data (TMV).
// We scrape listings as retail comps; price data feeds the valuation engine.

import type { Deal } from "@/types";
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const EDMUNDS_CONFIG: ScraperConfig = {
  name: "Edmunds",
  baseUrl: "https://www.edmunds.com",
  renderMode: "adaptive",
  requestDelay: 2500,
  concurrency: 2,
  useProxies: true,
  stealth: true,
  maxPages: 15,
  headers: { "Accept-Language": "en-US,en;q=0.9" },
};

// Cover multiple ZIP codes for national inventory
const COVERAGE_ZIPS = ["10001", "90001", "60601", "77001", "85001", "78701", "98101", "80201"];

export async function scrapeEdmunds(): Promise<number> {
  console.log("[Edmunds] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  for (const zip of COVERAGE_ZIPS) {
    const gen = paginate<Partial<Deal>>(
      EDMUNDS_CONFIG,
      (page) => `https://www.edmunds.com/used-cars/all/all/?zip=${zip}&pagenum=${page}&pagesize=25`,
      async (rawInput) => {
        const html = typeof rawInput === "string" ? rawInput : "";
        const items: Partial<Deal>[] = [];

        // Try JSON-LD structured data first (Edmunds embeds it)
        try {
          const cheerio = await import("cheerio");
          const $ = cheerio.load(html);

          // Try to extract from next.js __NEXT_DATA__
          const nextData = $("#__NEXT_DATA__").text();
          if (nextData) {
            const parsed = JSON.parse(nextData);
            const inventory = parsed?.props?.pageProps?.vehicleData?.inventories?.results
              || parsed?.props?.pageProps?.listings
              || [];
            for (const v of inventory) {
              const id = v.vin || v.id || String(v.stockNo || "");
              if (!id || seen.has(id)) continue;
              seen.add(id);
              const price = v.prices?.displayPrice || v.price || v.askingPrice;
              if (!price) continue;
              const title = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
              items.push({
                source: "edmunds",
                source_deal_id: id,
                source_url: v.url ? normalizeUrl(v.url, EDMUNDS_CONFIG.baseUrl) : "",
                title,
                year: v.year,
                make: v.make || "",
                model: v.model || "",
                trim: v.trim,
                vin: v.vin,
                ask_price: extractPrice(String(price)) || 0,
                mileage: v.mileage || v.odometer,
                condition: (v.type || "").toLowerCase().includes("new") ? "new" : "clean",
                seller_type: "dealer",
                seller: v.dealer?.name || v.sellerName || "Dealer",
                location_city: v.dealer?.city || v.city || "",
                location_state: v.dealer?.stateCode || v.state || "",
                images: Array.isArray(v.photos) ? v.photos.slice(0, 8) : [],
                metadata: { edmunds_rating: v.rating, tmv: v.prices?.tmv },
              });
            }
            if (items.length) {
              return { items, hasMore: items.length >= 25 };
            }
          }

          // HTML fallback
          $('[data-tracking-parent="edm-subnav-inventory"], .inventory-listing, [class*="InventoryListing"]').each((_, el) => {
            const card = $(el);
            const title = card.find("h3, [class*='title']").first().text().trim();
            if (!title) return;
            const priceText = card.find("[class*='price']").first().text();
            const price = extractPrice(priceText);
            if (!price) return;
            const link = card.find("a[href*='/vin/']").first().attr("href") || card.find("a").first().attr("href");
            const vin = link?.match(/\/vin\/([A-HJ-NPR-Z0-9]{17})/i)?.[1] || "";
            const id = vin || link?.split("/").filter(Boolean).pop() || "";
            if (!id || seen.has(id)) return;
            seen.add(id);
            const imgSrc = card.find("img").first().attr("src");
            const mileText = card.find("[class*='mileage'], [class*='miles']").first().text();
            const year = extractYear(title);
            const parts = title.split(" ");
            items.push({
              source: "edmunds",
              source_deal_id: id,
              source_url: link ? normalizeUrl(link, EDMUNDS_CONFIG.baseUrl) : "",
              title,
              year,
              make: parts[year ? 1 : 0] || "",
              model: parts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "",
              vin: vin || undefined,
              ask_price: price,
              mileage: extractMileage(mileText),
              condition: "clean",
              seller_type: "dealer",
              images: imgSrc ? [imgSrc] : [],
            });
          });
        } catch { /* skip */ }

        const hasMore = items.length >= 25;
        return { items, hasMore };
      },
    );
    for await (const batch of gen) allDeals.push(...batch);
  }

  console.log(`[Edmunds] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
