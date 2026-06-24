// lib/scrapers/sources/lkq.ts
// ─── LKQ / Row52 — salvage yard parts pricing ────────────────────────────────
// LKQ is the largest salvage parts network in North America.
// Row52 is their U-Pull-It inventory search (public-facing, no auth).
// We use this to cross-reference real-world parts prices for repair cost estimates.
// Deals written here go into the deals table with source="lkq" so the valuation
// engine can look up actual parts costs when scoring repairable vehicles.

import type { Deal } from "@/types";
import { paginate, extractPrice, extractYear, normalizeUrl, type ScraperConfig } from "../engine";
import { upsertDeals } from "../pipeline";

export const LKQ_CONFIG: ScraperConfig = {
  name: "LKQ",
  baseUrl: "https://row52.com",
  renderMode: "static",
  requestDelay: 1500,
  concurrency: 3,
  useProxies: false,
  stealth: false,
  maxPages: 10,
};

// Common parts searched for repair-cost anchoring
const PART_QUERIES = [
  "engine", "transmission", "front+bumper", "hood", "door", "fender",
  "airbag", "alternator", "axle", "catalytic+converter",
];

// Top US salvage markets by volume
const COVERAGE_STATES = ["CA", "TX", "FL", "NY", "IL", "PA", "OH", "GA", "NC", "MI"];

export async function scrapeLkq(): Promise<number> {
  console.log("[LKQ/Row52] Starting parts pricing scrape...");
  const seen = new Set<string>();
  const allDeals: Partial<Deal>[] = [];

  for (const state of COVERAGE_STATES) {
    for (const part of PART_QUERIES.slice(0, 4)) { // cap per run — 4 parts × 10 states = 40 queries
      const gen = paginate<Partial<Deal>>(
        LKQ_CONFIG,
        (page) => `https://row52.com/Search/?Year=0&YearTo=0&Miles=&MilesTo=&stateAbbrev=${state}&searchTerm=${part}&Page=${page}`,
        async (rawInput) => {
          const html = typeof rawInput === "string" ? rawInput : "";
          const cheerio = await import("cheerio");
          const $ = cheerio.load(html);
          const items: Partial<Deal>[] = [];

          $(".vehicle-row, tr.result-row, [class*='VehicleRow']").each((_, el) => {
            const row = $(el);
            const yearText = row.find(".year, td:nth-child(1)").first().text().trim();
            const make = row.find(".make, td:nth-child(2)").first().text().trim();
            const model = row.find(".model, td:nth-child(3)").first().text().trim();
            const priceText = row.find(".price, td:nth-child(6), [class*='price']").first().text();
            const price = extractPrice(priceText);
            const location = row.find(".location, .yard-name, td:nth-child(5)").first().text().trim();
            const link = row.find("a").first().attr("href");
            const id = link?.split("/").filter(Boolean).pop()?.split("?")[0] || `${yearText}-${make}-${model}-${state}-${part}`;

            if (!make || !model || seen.has(id)) return;
            seen.add(id);

            const year = parseInt(yearText) || extractYear(yearText);
            const title = [year, make, model, `(${part.replace("+", " ")})`].filter(Boolean).join(" ");

            items.push({
              source: "lkq",
              source_deal_id: id,
              source_url: link ? normalizeUrl(link, LKQ_CONFIG.baseUrl) : LKQ_CONFIG.baseUrl,
              title,
              year: year || undefined,
              make,
              model,
              ask_price: price || 0,
              condition: "salvage_title",
              seller_type: "dealer",
              seller: "LKQ / Row52",
              location_state: state,
              location_city: location,
              images: [],
              metadata: {
                part_type: part.replace("+", " "),
                salvage_yard: true,
                use_for_repair_estimate: true,
              },
            });
          });

          const hasMore = $(".pagination .next, [aria-label='Next']").length > 0 && items.length > 0;
          return { items, hasMore };
        },
      );
      for await (const batch of gen) allDeals.push(...batch);
    }
  }

  console.log(`[LKQ/Row52] Found ${allDeals.length} parts/salvage entries`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
