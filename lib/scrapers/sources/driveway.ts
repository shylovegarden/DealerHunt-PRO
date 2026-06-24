// lib/scrapers/sources/driveway.ts
// ─── Driveway (Lithia Motors) — large online used-car dealer ─────────────────
// Lithia is one of the largest dealer groups in the US. Driveway is their
// nationwide online retail arm. Clean title only, home delivery available.

import type { Deal } from "@/types";
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const DRIVEWAY_CONFIG: ScraperConfig = {
  name: "Driveway",
  baseUrl: "https://www.driveway.com",
  renderMode: "adaptive",
  requestDelay: 2500,
  concurrency: 2,
  useProxies: true,
  stealth: true,
  maxPages: 15,
};

export async function scrapeDriveway(): Promise<number> {
  console.log("[Driveway] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  const gen = paginate<Partial<Deal>>(
    DRIVEWAY_CONFIG,
    (page) => `https://www.driveway.com/cars-for-sale?page=${page}&pageSize=24`,
    async (rawInput) => {
      const html = typeof rawInput === "string" ? rawInput : "";
      const items: Partial<Deal>[] = [];

      // Try __NEXT_DATA__ JSON embed first
      try {
        const cheerio = await import("cheerio");
        const $ = cheerio.load(html);
        const nextData = $("#__NEXT_DATA__").text();
        if (nextData) {
          const parsed = JSON.parse(nextData);
          const vehicles = parsed?.props?.pageProps?.vehicles
            || parsed?.props?.pageProps?.inventory
            || parsed?.props?.pageProps?.listings
            || [];
          for (const v of vehicles) {
            const id = v.vin || v.stockNumber || String(v.id || "");
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const price = v.price || v.listPrice || v.internetPrice;
            if (!price) continue;
            const title = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
            items.push({
              source: "driveway",
              source_deal_id: id,
              source_url: v.url ? normalizeUrl(v.url, DRIVEWAY_CONFIG.baseUrl) : `https://www.driveway.com/cars/${id}`,
              title,
              year: v.year,
              make: v.make || "",
              model: v.model || "",
              trim: v.trim,
              vin: v.vin,
              ask_price: extractPrice(String(price)) || 0,
              mileage: v.mileage || v.odometer,
              condition: "clean",
              seller_type: "dealer",
              seller: "Driveway",
              location_city: v.city || "",
              location_state: v.state || v.stateCode || "",
              images: Array.isArray(v.images) ? v.images.slice(0, 8).map((i: any) => i.url || i) : [],
              metadata: { delivery_available: true, dealer_group: "Lithia Motors" },
            });
          }
          if (items.length) return { items, hasMore: items.length >= 24 };
        }
      } catch { /* fall through */ }

      // HTML fallback
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);
      $("[class*='VehicleCard'], [class*='vehicle-card'], .inventory-item").each((_, el) => {
        const card = $(el);
        const title = card.find("h2, h3, [class*='title']").first().text().trim();
        if (!title) return;
        const priceText = card.find("[class*='price']").first().text();
        const price = extractPrice(priceText);
        if (!price) return;
        const link = card.find("a").first().attr("href");
        const id = link?.split("/").filter(Boolean).pop()?.split("?")[0] || "";
        if (!id || seen.has(id)) return;
        seen.add(id);
        const imgSrc = card.find("img").first().attr("src");
        const mileText = card.find("[class*='mileage']").first().text();
        const year = extractYear(title);
        const parts = title.split(" ");
        items.push({
          source: "driveway",
          source_deal_id: id,
          source_url: link ? normalizeUrl(link, DRIVEWAY_CONFIG.baseUrl) : "",
          title, year,
          make: parts[year ? 1 : 0] || "",
          model: parts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "",
          ask_price: price,
          mileage: extractMileage(mileText),
          condition: "clean",
          seller_type: "dealer",
          seller: "Driveway",
          images: imgSrc ? [imgSrc] : [],
          metadata: { delivery_available: true },
        });
      });

      return { items, hasMore: items.length >= 24 };
    },
  );

  for await (const batch of gen) allDeals.push(...batch);

  console.log(`[Driveway] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
