// lib/housing/sources/publicsurplus-property.ts
//
// PublicSurplus REAL ESTATE (category 15) — the housing sibling of the cars PublicSurplus scraper. Same
// open HTML auction cards, but catid=15 is Real Estate: tax-forfeited land, mobile/manufactured homes,
// surplus municipal lots — deep-discount housing leads. Reuses the verified card regexes; maps to
// Property (houses only → vertical-isolated from the cars `deals` table). Free, no login, no proxy.

import type { Property, PropertyType } from "../types";

const BASE = "https://www.publicsurplus.com/sms/browse/cataucs";
const RE_CATID = 15; // Real Estate
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const decode = (t: string): string =>
  t
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function classify(title: string): PropertyType {
  const s = title.toLowerCase();
  if (/mobile|manufactured/.test(s)) return "mobile";
  if (/multi|duplex|triplex|fourplex|apartment/.test(s)) return "multi_family";
  if (/condo/.test(s)) return "condo";
  if (/town/.test(s)) return "townhouse";
  if (/\bland\b|lot|acre|parcel|forfeit|vacant/.test(s)) return "land";
  if (/\bbed\b|\bbath\b|house|home|residence|dwelling/.test(s))
    return "single_family";
  return "land"; // surplus RE skews land/parcels
}

/** Parse a PublicSurplus Real-Estate browse page into Property rows. */
export function parsePublicSurplusProperties(html: string): Property[] {
  const out: Property[] = [];
  const seen = new Set<string>();
  const re = /auction\/view\?auc=(\d+)"\s+title="#\d+\s*-\s*([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const auc = m[1];
    if (seen.has(auc)) continue;
    seen.add(auc);

    const title = decode(m[2]);

    // Current bid: <b id="val_<auc>catGrid"> $1,234.00 </b>
    const pm = html.match(
      new RegExp(`id="val_${auc}catGrid"[^>]*>\\s*\\$?([\\d,]+(?:\\.\\d+)?)`),
    );
    const price = pm ? Math.round(parseFloat(pm[1].replace(/,/g, ""))) : 0;
    if (!price) continue; // no live bid value => not a usable lead

    const sm = html.match(
      new RegExp(
        `auc=${auc}"[\\s\\S]{0,1600}?auction-item-state">\\s*([A-Z]{2})`,
      ),
    );
    const state = sm ? sm[1] : undefined;

    const beds = title.match(/(\d+)\s*bed/i);
    const baths = title.match(/(\d+(?:\.\d)?)\s*bath/i);

    out.push({
      source: "gov_auction",
      source_listing_id: `psre-${auc}`,
      source_url: `https://www.publicsurplus.com/sms/auction/view?auc=${auc}`,
      title,
      property_type: classify(title),
      description: title,
      state,
      price,
      beds: beds ? parseInt(beds[1], 10) : undefined,
      baths: baths ? parseFloat(baths[1]) : undefined,
      seller_type: "gov",
      seller: "PublicSurplus (gov surplus)",
      images: [],
      signals: {
        auction: true,
        channel: "gov_real_estate",
        marketplace: "publicsurplus",
      },
      scraped_at: new Date().toISOString(),
    });
  }
  return out;
}

export async function scrapePublicSurplusProperties(
  maxPages = 5,
): Promise<Property[]> {
  console.log("[HomeIQ:PublicSurplus] harvesting real estate...");
  const byId = new Map<string, Property>();
  let prevFirst = "";
  for (let page = 1; page <= maxPages; page++) {
    try {
      const res = await fetch(`${BASE}?catid=${RE_CATID}&page=${page}`, {
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      });
      if (!res.ok) break;
      const items = parsePublicSurplusProperties(await res.text());
      if (!items.length) break;
      // Past the last page it loops to page 1 — stop when the first lot repeats.
      const first = items[0].source_listing_id || "";
      if (first === prevFirst) break;
      prevFirst = first;
      for (const p of items) byId.set(p.source_listing_id!, p);
      await new Promise((r) => setTimeout(r, 700));
    } catch (e) {
      console.warn(
        `[HomeIQ:PublicSurplus] page ${page} failed:`,
        (e as Error).message,
      );
      break;
    }
  }
  const properties = Array.from(byId.values());
  console.log(`[HomeIQ:PublicSurplus] found ${properties.length} properties`);
  return properties;
}
