// lib/housing/sources/redfin.ts
//
// Redfin — the big national portal. Antigravity confirmed (docs/findings/redfin-listings.md) that Redfin
// embeds each listing as schema.org `SingleFamilyResidence`/`Residence` JSON-LD in the page, which our
// genericExtractProperties already reads — a drop-in. The only wall is the FETCH: Redfin runs PerimeterX,
// so smartFetch must reach its headed real-Chrome tier (the FLEET's clean IP, ENABLE_HEADED_SCRAPERS).
// From a flagged IP / plain serverless it returns blocked → []. Houses only → Property rows (isolated).
//
// Search URLs come from config (REDFIN_SEARCH_URLS, comma-separated city/region pages) so we never ship
// guessed IDs; the fleet supplies the real metro URLs. The PARSE path is verified by genericExtractProperties.

import { smartFetch } from "../../scrapers/smart-fetch";
import { genericExtractProperties } from "../extract-property";
import { stableId } from "../../db/stable-id";
import type { Property } from "../types";

// Stable id from the listing's own URL (or address) so upserts dedupe across runs.
function listingId(p: Property): string | null {
  const basis = p.source_url || `${p.address || ""}|${p.zip || p.city || ""}`;
  if (!basis.trim()) return null;
  return stableId(basis, "redfin");
}

/** Parse a Redfin page's embedded schema.org listings into HomeIQ Properties. */
export function parseRedfinHtml(html: string): Property[] {
  const out: Property[] = [];
  for (const p of genericExtractProperties(html, "redfin")) {
    const id = listingId(p);
    if (!id) continue;
    p.source_listing_id = id;
    out.push(p);
  }
  return out;
}

function configuredUrls(): string[] {
  return (process.env.REDFIN_SEARCH_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Harvest Redfin metro/search pages (needs the fleet's headed tier to clear PerimeterX). */
export async function scrapeRedfin(
  urls: string[] = configuredUrls(),
): Promise<Property[]> {
  if (!urls.length) {
    console.log("[HomeIQ:Redfin] no REDFIN_SEARCH_URLS configured — skipping");
    return [];
  }
  console.log(`[HomeIQ:Redfin] harvesting ${urls.length} pages...`);
  const byId = new Map<string, Property>();
  for (const url of urls) {
    try {
      const { html, blocked } = await smartFetch(url, {
        validate: (h) => parseRedfinHtml(h).length > 0,
      });
      if (blocked || !html) {
        console.warn(
          `[HomeIQ:Redfin] blocked/empty: ${url} (needs a clean IP + headed tier)`,
        );
        continue;
      }
      for (const p of parseRedfinHtml(html)) byId.set(p.source_listing_id!, p);
    } catch (e) {
      console.warn(`[HomeIQ:Redfin] ${url} failed:`, (e as Error).message);
    }
  }
  const properties = Array.from(byId.values());
  console.log(`[HomeIQ:Redfin] found ${properties.length} listings`);
  return properties;
}
