// lib/scrapers/sources/carmax.ts
// ─── CarMax — largest used-car retailer by volume ────────────────────────────
// CarMax serves a JSON API that backs its search page. We hit the API directly,
// which is faster and more reliable than parsing the React-rendered HTML.
// Retail comps only (all clean title, dealer-sold) — feeds the valuation engine.

import type { Deal } from "@/types";
import {
  paginate,
  extractYear,
  normalizeUrl,
  type ScraperConfig,
} from "../engine";
import { upsertDeals } from "../pipeline";

export const CARMAX_CONFIG: ScraperConfig = {
  name: "CarMax",
  baseUrl: "https://www.carmax.com",
  renderMode: "adaptive", // try static API first, fall back to browser
  requestDelay: 2500,
  concurrency: 2,
  useProxies: true,
  stealth: true,
  maxPages: 20,
  headers: {
    "Accept": "application/json, text/html,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.carmax.com/cars",
  },
};

// CarMax's internal search API — returns JSON with vehicle data.
// page is 0-indexed.
function buildApiUrl(page: number, zip = "90001"): string {
  const params = new URLSearchParams({
    zip,
    page: String(page),
    pageSize: "24",
    sortKey: "bestmatch",
    sortDirection: "desc",
  });
  return `https://www.carmax.com/cars/api/search/run?${params}`;
}

interface CarMaxApiItem {
  stockNumber?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  price?: number;
  listPrice?: number;
  location?: { city?: string; stateCode?: string };
  images?: { url?: string }[];
  vehicleType?: string;
  certified?: boolean;
  vin?: string;
}

// Spread of ZIP codes to get national coverage (one per major metro region).
const COVERAGE_ZIPS = [
  "10001", // New York
  "90001", // Los Angeles
  "60601", // Chicago
  "77001", // Houston
  "85001", // Phoenix
  "19101", // Philadelphia
  "78201", // San Antonio
  "92101", // San Diego
  "75201", // Dallas
  "95101", // San Jose
  "78701", // Austin
  "32099", // Jacksonville
  "76101", // Fort Worth
  "43201", // Columbus
  "78201", // Charlotte (reuse)
  "46201", // Indianapolis
  "94101", // San Francisco
  "98101", // Seattle
  "39201", // Nashville / Memphis area
  "80201", // Denver
];

export async function scrapeCarMax(): Promise<number> {
  console.log("[CarMax] Starting scrape across national ZIP coverage...");
  const seen = new Set<string>(); // dedupe by stockNumber across ZIPs
  const allDeals: Partial<Deal>[] = [];

  for (const zip of COVERAGE_ZIPS) {
    console.log(`[CarMax] Scraping ZIP ${zip}...`);

    const gen = paginate<Partial<Deal>>(
      CARMAX_CONFIG,
      (page) => buildApiUrl(page - 1, zip), // paginate() is 1-indexed; API is 0-indexed
      async (rawInput) => {
        const html = typeof rawInput === "string" ? rawInput : "";
        const items: Partial<Deal>[] = [];

        // Try JSON API response first
        try {
          const data = JSON.parse(html);
          const vehicles: CarMaxApiItem[] = data?.items || data?.vehicles || data?.results || [];

          for (const v of vehicles) {
            const id = String(v.stockNumber || v.vin || "");
            if (!id || seen.has(id)) continue;
            seen.add(id);

            const price = v.price || v.listPrice;
            if (!price || price < 1000) continue;

            const title = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
            const imgUrl = v.images?.[0]?.url;

            items.push({
              source: "carmax",
              source_deal_id: id,
              source_url: `https://www.carmax.com/car/${id}`,
              title,
              year: v.year,
              make: v.make || "",
              model: v.model || "",
              trim: v.trim,
              vin: v.vin,
              ask_price: price,
              mileage: v.mileage,
              condition: "clean", // CarMax only sells clean-title vehicles
              seller_type: "dealer",
              seller: "CarMax",
              location_city: v.location?.city,
              location_state: v.location?.stateCode,
              images: imgUrl ? [imgUrl] : [],
              metadata: {
                certified: v.certified || false,
                vehicle_type: v.vehicleType,
              },
            });
          }

          const totalCount = data?.totalCount || data?.count || 0;
          const currentOffset = (parseInt(new URLSearchParams(buildApiUrl(0, zip).split("?")[1]).get("page") || "0")) + 1;
          const hasMore = items.length > 0 && allDeals.length + items.length < Math.min(totalCount, 200);
          return { items, hasMore };
        } catch {
          // JSON parse failed — fall through to HTML parsing
        }

        // HTML fallback: CarMax React page
        const cheerio = await import("cheerio");
        const $ = cheerio.load(html);

        $('[data-qa="vehicle-card"], .vehicle-card, [class*="VehicleCard"]').each((_, el) => {
          const card = $(el);
          const titleEl = card.find('[data-qa="vehicle-title"], h2, h3').first();
          const title = titleEl.text().trim();
          if (!title) return;

          const priceText = card.find('[data-qa="price"], [class*="price"]').first().text();
          const price = parseInt(priceText.replace(/[^0-9]/g, ""));
          if (!price || price < 1000) return;

          const mileText = card.find('[data-qa="mileage"], [class*="mileage"]').first().text();
          const miles = parseInt(mileText.replace(/[^0-9]/g, ""));

          const link = card.find("a[href*='/car/']").first().attr("href");
          const stockNum = link?.match(/\/car\/(\d+)/)?.[1] || "";
          if (!stockNum || seen.has(stockNum)) return;
          seen.add(stockNum);

          const imgSrc = card.find("img").first().attr("src");
          const year = extractYear(title);
          const parts = title.split(" ");
          const make = parts[year ? 1 : 0] || "";
          const model = parts.slice(year ? 2 : 1, year ? 4 : 3).join(" ");

          items.push({
            source: "carmax",
            source_deal_id: stockNum,
            source_url: link ? normalizeUrl(link, CARMAX_CONFIG.baseUrl) : "",
            title,
            year,
            make,
            model,
            ask_price: price,
            mileage: miles || undefined,
            condition: "clean",
            seller_type: "dealer",
            seller: "CarMax",
            images: imgSrc ? [imgSrc] : [],
          });
        });

        const hasMore = $('[aria-label="Next page"], .pagination-next').length > 0 && items.length > 0;
        return { items, hasMore };
      },
    );

    for await (const batch of gen) {
      allDeals.push(...batch);
    }
  }

  console.log(`[CarMax] Found ${allDeals.length} deals across all ZIPs`);
  if (allDeals.length > 0) {
    await upsertDeals(allDeals);
  }
  return allDeals.length;
}
