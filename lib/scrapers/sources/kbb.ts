// lib/scrapers/sources/kbb.ts
// ─── Kelley Blue Book (KBB) — listings + market value benchmark ───────────────
// KBB is owned by Cox Automotive (same parent as AutoTrader/Manheim).
// It has a listings marketplace on top of its valuation tool.
// Retail comps here are especially trusted by consumers — good resale signal.

import type { Deal } from "@/types";
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const KBB_CONFIG: ScraperConfig = {
  name: "KBB",
  baseUrl: "https://www.kbb.com",
  renderMode: "adaptive",
  requestDelay: 2500,
  concurrency: 2,
  useProxies: true,
  stealth: true,
  maxPages: 15,
  headers: { "Accept-Language": "en-US,en;q=0.9" },
};

const COVERAGE_ZIPS = ["10001", "90001", "60601", "77001", "85001", "75201", "98101", "30301"];

export async function scrapeKbb(): Promise<number> {
  console.log("[KBB] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  for (const zip of COVERAGE_ZIPS) {
    const gen = paginate<Partial<Deal>>(
      KBB_CONFIG,
      (page) => `https://www.kbb.com/cars-for-sale/used-cars/?zip=${zip}&startindex=${(page - 1) * 25}`,
      async (rawInput) => {
        const html = typeof rawInput === "string" ? rawInput : "";
        const cheerio = await import("cheerio");
        const $ = cheerio.load(html);
        const items: Partial<Deal>[] = [];

        // KBB embeds inventory in script tag as JSON
        try {
          const scriptData = $("script[type='application/ld+json']").toArray()
            .map(el => { try { return JSON.parse($(el).html() || ""); } catch { return null; } })
            .filter(Boolean)
            .find(d => d?.["@type"] === "ItemList" || Array.isArray(d?.itemListElement));

          if (scriptData?.itemListElement) {
            for (const item of scriptData.itemListElement) {
              const v = item.item || item;
              const id = v.sku || v.productID || v.name?.replace(/\s+/g, "-") || "";
              if (!id || seen.has(id)) continue;
              seen.add(id);
              items.push({
                source: "kbb",
                source_deal_id: id,
                source_url: v.url ? normalizeUrl(v.url, KBB_CONFIG.baseUrl) : "",
                title: v.name || "",
                year: extractYear(v.name || ""),
                make: v.brand?.name || "",
                model: v.model || "",
                ask_price: extractPrice(String(v.offers?.price || 0)) || 0,
                mileage: v.mileageFromOdometer?.value,
                condition: "clean",
                seller_type: "dealer",
                images: v.image ? [v.image] : [],
              });
            }
            if (items.length) return { items, hasMore: items.length >= 25 };
          }
        } catch { /* fall through to HTML */ }

        // HTML fallback
        $("[data-test='results-item'], .vehicle-card, [class*='VehicleCard']").each((_, el) => {
          const card = $(el);
          const title = card.find("h2, h3, [data-test='vehicle-title']").first().text().trim();
          if (!title) return;
          const priceText = card.find("[data-test='price-section'], [class*='price']").first().text();
          const price = extractPrice(priceText);
          if (!price) return;
          const link = card.find("a").first().attr("href");
          const id = link?.split("/").filter(Boolean).pop()?.split("?")[0] || "";
          if (!id || seen.has(id)) return;
          seen.add(id);
          const imgSrc = card.find("img").first().attr("src");
          const mileText = card.find("[data-test='mileage'], [class*='mileage']").first().text();
          const year = extractYear(title);
          const parts = title.split(" ");
          items.push({
            source: "kbb",
            source_deal_id: id,
            source_url: link ? normalizeUrl(link, KBB_CONFIG.baseUrl) : "",
            title,
            year,
            make: parts[year ? 1 : 0] || "",
            model: parts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "",
            ask_price: price,
            mileage: extractMileage(mileText),
            condition: "clean",
            seller_type: "dealer",
            images: imgSrc ? [imgSrc] : [],
          });
        });

        return { items, hasMore: items.length >= 25 };
      },
    );
    for await (const batch of gen) allDeals.push(...batch);
  }

  console.log(`[KBB] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
