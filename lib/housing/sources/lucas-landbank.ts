// lib/housing/sources/lucas-landbank.ts
//
// Lucas County Land Bank (lucascountylandbank.org) — Toledo, OH. Its /properties page is a Framer site
// that server-renders each home as HTML keyed by stable `data-framer-name` anchors: a status badge
// ("Move-In Ready" / "Needs Renovation"), a neighborhood ("West Toledo"), an "Address Price" block with
// the street and a $ price. Cheap rehab/flip houses ($5k–25k). Parsed directly (no proxy/API). Houses
// only → vertical-isolated from the cars `deals` table (Property carries an address; no make/model/year).

import type { Property, PropertyType } from "../types";

const ORIGIN = "https://lucascountylandbank.org";
const LIST_URL = `${ORIGIN}/properties`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const strip = (t: string): string =>
  t
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function classify(status: string): PropertyType {
  const s = status.toLowerCase();
  if (/vacant lot|\blot\b|\bland\b|vacant land/.test(s)) return "land";
  if (/multi|duplex|two.?family|apartment/.test(s)) return "multi_family";
  return "single_family"; // Toledo land-bank homes
}

/** Parse the Lucas County Framer /properties page into Property rows. */
export function parseLucasLandBank(html: string): Property[] {
  const out: Property[] = [];
  const seen = new Set<string>();
  // Each home is one "Address Price" block; the status badge + neighborhood render just before it.
  const chunks = html.split('data-framer-name="Address Price"');
  for (let i = 1; i < chunks.length; i++) {
    const card = chunks[i].slice(0, 4000);
    const before = chunks[i - 1].slice(-2000);

    const addrM = card.match(
      /data-framer-name="Address"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/,
    );
    const street = addrM ? strip(addrM[1]) : "";
    if (!street) continue;

    const priceM = card.match(/\$([0-9]{1,3}(?:,[0-9]{3})+)/);
    const price = priceM
      ? parseInt(priceM[1].replace(/,/g, ""), 10)
      : undefined;

    const statusM = before.match(
      />(Move-In Ready|Needs Renovation|Pending|Available|Sold|Under Contract|Coming Soon|Vacant Lot|Renovation[^<]*)</,
    );
    const status = statusM ? strip(statusM[1]) : "";
    const nbhdM = before.match(
      />((?:North|South|East|West|Central|Downtown|Southwest|Southeast|Northwest|Northeast)?\s*Toledo)</,
    );
    const neighborhood = nbhdM ? strip(nbhdM[1]) : undefined;

    const id = slug(street);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    out.push({
      source: "land_bank",
      source_listing_id: `lclb-${id}`,
      source_url: LIST_URL,
      title: `${street}, Toledo OH`,
      property_type: classify(status),
      address: street,
      city: "Toledo",
      state: "OH",
      price,
      seller_type: "gov",
      seller: "Lucas County Land Bank",
      description: status || undefined,
      signals: {
        land_bank: true,
        channel: "land_bank",
        marketplace: "lucas_landbank",
        neighborhood,
        status: status || undefined,
      },
      scraped_at: new Date().toISOString(),
    });
  }
  return out;
}

export async function scrapeLucasLandBank(): Promise<Property[]> {
  console.log("[HomeIQ:LucasLandBank] harvesting...");
  try {
    const res = await fetch(LIST_URL, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) {
      console.warn(`[HomeIQ:LucasLandBank] HTTP ${res.status}`);
      return [];
    }
    const properties = parseLucasLandBank(await res.text());
    console.log(`[HomeIQ:LucasLandBank] found ${properties.length} properties`);
    return properties;
  } catch (e) {
    console.warn("[HomeIQ:LucasLandBank] failed:", (e as Error).message);
    return [];
  }
}
