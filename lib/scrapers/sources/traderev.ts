// lib/scrapers/sources/traderev.ts
// ─── TradeRev — dealer-to-dealer digital auction platform ─────────────────────
// TradeRev (now part of KAR Global / OPENLANE) is a mobile auction platform
// where dealers auction off trade-ins to other dealers in real time.
// Prices here are wholesale/trade — crucial for accurate flip-margin analysis.

import type { Deal } from "@/types";
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const TRADEREV_CONFIG: ScraperConfig = {
  name: "TradeRev",
  baseUrl: "https://www.traderev.com",
  renderMode: "adaptive",
  requestDelay: 2500,
  concurrency: 2,
  useProxies: true,
  stealth: true,
  maxPages: 15,
};

export async function scrapeTradeRev(): Promise<number> {
  console.log("[TradeRev] Starting scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  const gen = paginate<Partial<Deal>>(
    TRADEREV_CONFIG,
    (page) => `https://www.traderev.com/en-us/marketplace?page=${page}`,
    async (rawInput) => {
      const html = typeof rawInput === "string" ? rawInput : "";
      const items: Partial<Deal>[] = [];

      // TradeRev is a React SPA — try __NEXT_DATA__ or inline JSON first
      try {
        const cheerio = await import("cheerio");
        const $ = cheerio.load(html);

        const nextData = $("#__NEXT_DATA__").text()
          || $("script[type='application/json']").first().text();
        if (nextData) {
          const parsed = JSON.parse(nextData);
          const vehicles = parsed?.props?.pageProps?.vehicles
            || parsed?.props?.pageProps?.auctions
            || parsed?.vehicles
            || [];
          for (const v of vehicles) {
            const id = v.vin || v.vehicleId || String(v.id || "");
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const price = v.currentBid || v.startingBid || v.price || v.buyNowPrice;
            if (!price) continue;
            const title = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
            items.push({
              source: "traderev",
              source_deal_id: id,
              source_url: v.url ? normalizeUrl(v.url, TRADEREV_CONFIG.baseUrl) : `https://www.traderev.com/en-us/vehicle/${id}`,
              title,
              year: v.year,
              make: v.make || "",
              model: v.model || "",
              trim: v.trim,
              vin: v.vin,
              ask_price: extractPrice(String(price)) || 0,
              mileage: v.mileage || v.odometer,
              condition: v.condition?.toLowerCase() || "run_drive",
              seller_type: "dealer",
              seller: v.sellerName || "Dealer (TradeRev)",
              location_city: v.city || v.location?.city || "",
              location_state: v.state || v.location?.stateCode || "",
              images: Array.isArray(v.images) ? v.images.slice(0, 8).map((i: any) => i.url || i) : [],
              auction_end: v.endTime ? new Date(v.endTime).toISOString() : null,
              bid_count: v.bidCount || v.numberOfBids || null,
              metadata: {
                wholesale: true,
                dealer_to_dealer: true,
                auction_type: "digital_wholesale",
                current_bid: extractPrice(String(price)) || 0,
              },
            });
          }
          if (items.length) return { items, hasMore: items.length >= 20 };
        }
      } catch { /* fall through */ }

      // HTML fallback for partial renders
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);
      $("[class*='VehicleCard'], [class*='AuctionCard'], [class*='vehicle-card']").each((_, el) => {
        const card = $(el);
        const title = card.find("h2, h3, [class*='title']").first().text().trim();
        if (!title) return;
        const priceText = card.find("[class*='bid'], [class*='price']").first().text();
        const price = extractPrice(priceText);
        if (!price) return;
        const link = card.find("a").first().attr("href");
        const id = link?.split("/").filter(Boolean).pop()?.split("?")[0] || "";
        if (!id || seen.has(id)) return;
        seen.add(id);
        const imgSrc = card.find("img").first().attr("src");
        const mileText = card.find("[class*='mileage'], [class*='miles']").first().text();
        const year = extractYear(title);
        const parts = title.split(" ");
        const endTime = card.find("[class*='timer'], [class*='end-time'], time").first().attr("datetime");
        items.push({
          source: "traderev",
          source_deal_id: id,
          source_url: link ? normalizeUrl(link, TRADEREV_CONFIG.baseUrl) : "",
          title, year,
          make: parts[year ? 1 : 0] || "",
          model: parts.slice(year ? 2 : 1, year ? 4 : 3).join(" ") || "",
          ask_price: price,
          mileage: extractMileage(mileText),
          condition: "run_drive",
          seller_type: "dealer",
          seller: "Dealer (TradeRev)",
          images: imgSrc ? [imgSrc] : [],
          auction_end: endTime ? new Date(endTime).toISOString() : null,
          metadata: { wholesale: true, dealer_to_dealer: true },
        });
      });

      return { items, hasMore: items.length >= 20 };
    },
  );

  for await (const batch of gen) allDeals.push(...batch);

  console.log(`[TradeRev] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
