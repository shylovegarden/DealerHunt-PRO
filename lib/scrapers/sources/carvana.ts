// lib/scrapers/sources/carvana.ts
// Carvana exposes its ENTIRE inventory (~73k vehicles) via an open JSON API — no Cloudflare, no
// FlareSolverr, no browser. POST to /merch/search/api/v2/search and read inventory.vehicles: clean
// vin/year/make/model/trim/mileage/price/images. The single best free retail comp source we have.

import type { Deal } from "@/types";
import { upsertDeals } from "../pipeline";

const CARVANA_API = "https://apik.carvana.io/merch/search/api/v2/search";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const s = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/** Map a Carvana search-API response (inventory.vehicles) into deal rows. */
export function parseCarvanaVehicles(json: any): Partial<Deal>[] {
  const vehicles = json?.inventory?.vehicles;
  if (!Array.isArray(vehicles)) return [];
  const items: Partial<Deal>[] = [];
  for (const v of vehicles) {
    if (!v || typeof v !== "object") continue;
    const price = Number(
      v.price?.total ?? v.price?.incentivizedPrice ?? v.price?.msrp ?? 0,
    );
    const vin = s(v.vin);
    if (!price || !vin) continue;
    const year = Number(v.year) || undefined;
    const make = s(v.make);
    const model = s(v.parentModel) || s(v.model);
    const trim = s(v.trim) || s(v.kbbTrim);
    const img = s(v.imageUrl) || s(v.jellyBeanDesktopUrl);
    const id = String(v.vehicleId ?? v.stockNumber ?? vin);
    items.push({
      source: "carvana",
      source_deal_id: vin || id,
      source_url: v.vdpSlug
        ? `https://www.carvana.com/vehicle/${v.vdpSlug}`
        : `https://www.carvana.com/vehicle/${id}`,
      title: `${year || ""} ${make || ""} ${model || ""} ${trim || ""}`
        .replace(/\s+/g, " ")
        .trim(),
      year,
      make,
      model,
      trim,
      vin,
      ask_price: price,
      mileage: Number(v.mileage) || 0,
      condition: "clean", // Carvana is reconditioned clean-title retail
      images: img ? [img] : [],
      seller_type: "dealer",
      seller: "Carvana",
      metadata: { delivery_available: true, seven_day_return: true },
      scraped_at: new Date().toISOString(),
    });
  }
  return items;
}

export async function scrapeCarvana(
  maxPages = 15,
  pageSize = 50,
): Promise<number> {
  console.log("[Carvana] Starting API scrape...");
  const all: Partial<Deal>[] = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const res = await fetch(CARVANA_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": UA,
          Origin: "https://www.carvana.com",
          Accept: "application/json",
        },
        body: JSON.stringify({ pagination: { page, pageSize }, filters: {} }),
      });
      if (!res.ok) {
        console.warn(`[Carvana] page ${page} HTTP ${res.status} — stopping`);
        break;
      }
      const items = parseCarvanaVehicles(await res.json());
      if (!items.length) break;
      all.push(...items);
      await new Promise((r) => setTimeout(r, 700)); // be polite
    } catch (e) {
      console.warn(`[Carvana] page ${page} failed:`, (e as Error).message);
      break;
    }
  }
  console.log(`[Carvana] Found ${all.length} vehicles`);
  if (all.length > 0) await upsertDeals(all);
  return all.length;
}
