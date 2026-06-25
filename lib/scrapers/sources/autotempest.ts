// lib/scrapers/sources/autotempest.ts
// Autotempest is a meta-search ENGINE — one query fans out to Cars.com, CarGurus, Carvana, eBay,
// AutoTrader, TrueCar, CarMax, Facebook Marketplace, Hemmings, AutoByTel and more, then returns a
// single clean JSON feed (vin/year/make/model/trim/price/mileage/title/url + which site each came
// from). Its public results API (no login, no FlareSolverr) lets us pull MANY car-selling sites
// "under one roof" in one shot — including the ones whose own sites are bot-walled (CarMax, Cars.com,
// Facebook, TrueCar). Each listing is stored under its TRUE origin source (cars_com/cargurus/carvana/
// ebay_motors/autotrader/truecar/facebook_marketplace) so it flows into retail comps correctly; the
// origin is also kept in metadata.origin_site. A unique aggregator id keeps it from colliding with
// our direct scrapers' rows.

import type { Deal } from "@/types";
import { upsertDeals } from "../pipeline";
import { STATE_SEED_ZIPS } from "@/lib/geo";

const API = "https://www.autotempest.com/api/search";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Site codes Autotempest accepts; we ask for the whole network and keep whatever responds.
const SITES =
  "ah|at|cab|cg|cgc|cm|cs|ct|cv|eb|ebcom|fbm|hem|hemc|kj|ot|pa|ssm|st|tc|te";

// Broad market coverage — popular makes (model-less searches still return multiple sites). A handful
// of make+model combos pull the slower walled sites (CarMax/Carvana/TrueCar) too.
const QUERIES: Array<{ make: string; model?: string }> = [
  { make: "ford", model: "f150" },
  { make: "chevrolet", model: "silverado" },
  { make: "ram", model: "1500" },
  { make: "toyota", model: "camry" },
  { make: "toyota", model: "tacoma" },
  { make: "honda", model: "accord" },
  { make: "honda", model: "civic" },
  { make: "jeep", model: "wrangler" },
  { make: "nissan", model: "altima" },
  { make: "bmw" },
  { make: "subaru" },
  { make: "hyundai" },
  { make: "kia" },
  { make: "gmc" },
  { make: "lexus" },
];

const num = (v: unknown): number =>
  Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;
const s = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

// Map an Autotempest origin (sourceName) to our deal_source enum. Substring match so "Cars.com",
// "eBay Motors", etc. all resolve. Origins without a direct enum (CarMax, Hemmings, AutoByTel) fall to
// 'independent_dealer' (they're dealer/retail) — the true name is still kept in metadata + seller.
export function mapOriginToSource(sourceName: string): Deal["source"] {
  const n = sourceName.toLowerCase();
  if (n.includes("carvana")) return "carvana";
  if (n.includes("cars.com")) return "cars_com";
  if (n.includes("cargurus")) return "cargurus";
  if (n.includes("autotrader")) return "autotrader";
  if (n.includes("ebay")) return "ebay_motors";
  if (n.includes("truecar")) return "truecar";
  if (n.includes("facebook")) return "facebook_marketplace";
  return "independent_dealer";
}

function titleToCondition(t?: string): Deal["condition"] {
  const x = (t || "").toLowerCase();
  if (x.includes("salvage")) return "salvage_title";
  if (x.includes("rebuilt")) return "rebuilt_title";
  if (x.includes("flood")) return "flood";
  return "clean";
}

/** Parse an Autotempest results payload (json.results[]) into deal rows. */
export function parseAutotempest(json: any): Partial<Deal>[] {
  const results = json?.results;
  if (!Array.isArray(results)) return [];
  const items: Partial<Deal>[] = [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const price = num(r.price);
    const id = s(r.id) || s(r.externalId);
    if (!price || !id) continue;

    const year = parseInt(String(r.year), 10) || undefined;
    const make = s(r.make);
    const model = s(r.model);
    const trim = s(r.trim);
    const [city, state] = String(r.location || "")
      .split(",")
      .map((p) => p.trim());
    const origin = s(r.sourceName) || "Autotempest";
    const url = s(r.url);

    items.push({
      source: mapOriginToSource(origin),
      source_deal_id: `at-${id}`, // aggregator-prefixed so it never collides with direct scrapers

      source_url: url || "",
      title:
        s(r.title) ||
        `${year || ""} ${make || ""} ${model || ""} ${trim || ""}`
          .replace(/\s+/g, " ")
          .trim(),
      year,
      make,
      model,
      trim,
      vin: s(r.vin),
      ask_price: price,
      mileage: num(r.mileage),
      condition: titleToCondition(s(r.vehicleTitle)),
      images: s(r.img) ? [String(r.img).replace(/^\/\//, "https://")] : [],
      seller_type: /private/i.test(String(r.sellerType || ""))
        ? "private"
        : "dealer",
      seller: origin,
      location_city: city || undefined,
      location_state: state && state.length === 2 ? state : undefined,
      metadata: {
        aggregator: "autotempest",
        origin_site: origin,
        origin_sitecode: s(r.sitecode),
        deal_gauge: s(r.dealGaugeClass) || undefined,
        current_bid: num(r.currentBid) || undefined,
      },
      scraped_at: new Date().toISOString(),
    });
  }
  return items;
}

async function fetchQuery(
  q: { make: string; model?: string },
  zip: string,
): Promise<Partial<Deal>[]> {
  const params = new URLSearchParams({
    make: q.make,
    ...(q.model ? { model: q.model } : {}),
    zip,
    radius: "13000", // nationwide (API max)
    rpp: "50",
    srpp: "50",
    sort: "date_desc",
    sites: SITES,
    deduplicationSites: SITES,
  });
  const res = await fetch(`${API}?${params.toString()}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "https://www.autotempest.com/results",
    },
  });
  if (!res.ok) {
    console.warn(`[Autotempest] ${q.make} ${q.model || ""} HTTP ${res.status}`);
    return [];
  }
  return parseAutotempest(await res.json());
}

export async function scrapeAutotempest(): Promise<number> {
  console.log("[Autotempest] Starting aggregator scrape...");
  const zips = Object.values(STATE_SEED_ZIPS).filter(Boolean) as string[];
  const zip = zips[Math.floor(Math.random() * zips.length)] || "75201";

  const byId = new Map<string, Partial<Deal>>();
  for (const q of QUERIES) {
    try {
      const items = await fetchQuery(q, zip);
      for (const it of items) byId.set(it.source_deal_id!, it);
      await new Promise((r) => setTimeout(r, 1200)); // be polite to the aggregator
    } catch (e) {
      console.warn(
        `[Autotempest] ${q.make} ${q.model || ""} failed:`,
        (e as Error).message,
      );
    }
  }

  const deals = Array.from(byId.values());
  console.log(`[Autotempest] Found ${deals.length} listings across sites`);
  if (deals.length > 0) await upsertDeals(deals);
  return deals.length;
}
