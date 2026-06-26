// lib/scrapers/sources/autotrader.ts
// AutoTrader is a Next.js SPA — the old data-cmp/CSS selectors rotted. The full inventory is in the
// __NEXT_DATA__ JSON (props.pageProps.__eggsState.inventory), keyed by listing id, with clean
// year/make/model/trim/vin/mileage/price/images. We parse THAT via FlareSolverr (renderMode static).

import type { Deal } from "@/types";
import { type ScraperConfig } from "../engine";
import { withPatchrightSession } from "../tools/patchright-engine";
import { upsertDeals } from "../pipeline";
import { STATE_SEED_ZIPS } from "@/lib/geo";

export const AUTOTRADER_CONFIG: ScraperConfig = {
  name: "AutoTrader",
  baseUrl: "https://www.autotrader.com",
  renderMode: "static", // direct → FlareSolverr escalation on Cloudflare block
  requestDelay: 2500,
  concurrency: 1,
  useProxies: true,
  stealth: false,
  maxPages: 10,
  headers: {
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
};

/** Parse an AutoTrader SRP into listing rows from the embedded __NEXT_DATA__ inventory. */
export function parseAutotraderNextData(html: string): Partial<Deal>[] {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!m) return [];
  let nd: any;
  try {
    nd = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const inv = nd?.props?.pageProps?.__eggsState?.inventory;
  if (!inv || typeof inv !== "object") return [];

  const items: Partial<Deal>[] = [];
  for (const id of Object.keys(inv)) {
    const o = inv[id] || {};
    const listingType = String(o.listingType || "").toUpperCase();
    if (listingType === "NEW") continue; // used/CPO only — resale comps
    const price = Number(
      o.pricingDetail?.displayPrice ??
        o.pricingDetail?.dealerDiscountedPrice ??
        0,
    );
    const vin = o.vin;
    if (!price || !vin) continue;

    const make = o.make?.name || o.make?.code || undefined;
    const model = o.model?.name || o.model?.code || undefined;
    const trim =
      (typeof o.atTrim === "string" && o.atTrim) ||
      (typeof o.trim === "string" && o.trim) ||
      undefined;
    const mileage =
      parseInt(String(o.mileage?.value ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
    const images = Array.isArray(o.images?.sources)
      ? o.images.sources
          .map((s: any) => s?.src)
          .filter(Boolean)
          .slice(0, 8)
      : [];
    const url = o.vdpBaseUrl
      ? o.vdpBaseUrl.startsWith("http")
        ? o.vdpBaseUrl
        : `https://www.autotrader.com${o.vdpBaseUrl}`
      : `https://www.autotrader.com/cars-for-sale/vehicle/${id}`;

    items.push({
      source: "autotrader",
      source_deal_id: vin || String(id),
      source_url: url,
      title: `${o.year || ""} ${make || ""} ${model || ""} ${trim || ""}`
        .replace(/\s+/g, " ")
        .trim(),
      year: Number(o.year) || undefined,
      make,
      model,
      trim,
      vin,
      ask_price: price,
      mileage,
      condition: listingType === "CERTIFIED" ? "certified" : "clean",
      images,
      seller_type: "dealer",
      seller: o.ownerName || "AutoTrader",
      scraped_at: new Date().toISOString(),
    });
  }
  return items;
}

export async function scrapeAutoTrader(
  searchTerm = "",
  zip = "",
  maxPages = AUTOTRADER_CONFIG.maxPages,
) {
  // No zip → pick a random state seed ZIP so the rotation spreads geographic comp coverage
  // instead of re-scraping Dallas every cycle.
  if (!zip) {
    const zips = Object.values(STATE_SEED_ZIPS).filter(Boolean) as string[];
    zip = zips[Math.floor(Math.random() * zips.length)] || "75201";
  }
  console.log(`[AutoTrader] Starting scrape near ${zip}...`);
  const allDeals: Partial<Deal>[] = [];

  // Akamai-walled — static + FlareSolverr both serve a "page unavailable" interstitial. Drive the SRP
  // through a HEADED Patchright Chrome (PerimeterX/Akamai detect headless); verified to render the full
  // __NEXT_DATA__ inventory. CI must run under `xvfb-run` for the headed display.
  await withPatchrightSession(
    async (goto) => {
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
          zip,
          searchRadius: "100",
          ...(searchTerm && { makeCodeList: searchTerm }),
          startYear: "2010",
          numRecords: "25",
          firstRecord: String((page - 1) * 25),
        });
        const url = `https://www.autotrader.com/cars-for-sale/all-cars?${params.toString()}`;
        let items: Partial<Deal>[] = [];
        try {
          items = parseAutotraderNextData(await goto(url));
        } catch (e) {
          console.warn(
            `[AutoTrader] page ${page} failed: ${(e as Error).message}`,
          );
          break;
        }
        if (!items.length) break;
        allDeals.push(...items);
        if (items.length < 20) break;
      }
    },
    { tough: true },
  );

  console.log(`[AutoTrader] Found ${allDeals.length} deals`);
  if (allDeals.length > 0) await upsertDeals(allDeals);
  return allDeals.length;
}
