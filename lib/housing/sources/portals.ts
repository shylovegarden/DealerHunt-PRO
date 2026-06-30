// lib/housing/sources/portals.ts
//
// The big national LISTING portals (Zillow, Realtor.com, Homes.com, Movoto, Trulia — Redfin has its own
// module). They all ship listings as schema.org JSON-LD / __NEXT_DATA__, which genericExtractProperties
// already reads — so the PARSE is a drop-in. The only wall is the FETCH: every one runs aggressive
// anti-bot (PerimeterX / Cloudflare / DataDome) and their ToS forbid scraping, so smartFetch must reach
// the FLEET's clean-IP headed-Chrome / FlareSolverr tier. Each portal is therefore config-driven by a
// search-URL env var and degrades to [] when unconfigured or blocked — it activates the moment the fleet
// supplies a clean fetch + the metro search URLs (we never ship guessed IDs).
//
// NOTE: true MLS/IDX is a different class — it needs a RESO Web API / IDX feed via a brokerage license,
// not scraping. When a feed is available, add a RESO connector; these portal scrapers are the free path.

import { smartFetch } from "../../scrapers/smart-fetch";
import { genericExtractProperties } from "../extract-property";
import { stableId } from "../../db/stable-id";
import type { Property } from "../types";

interface Portal {
  source: string;
  env: string;
}

// One config per portal — add a portal by adding a line + setting its env var to comma-separated search URLs.
const PORTALS: Portal[] = [
  { source: "zillow", env: "ZILLOW_SEARCH_URLS" },
  { source: "realtor", env: "REALTOR_SEARCH_URLS" },
  { source: "homes", env: "HOMES_SEARCH_URLS" },
  { source: "movoto", env: "MOVOTO_SEARCH_URLS" },
  { source: "trulia", env: "TRULIA_SEARCH_URLS" },
];

// Stable id from the listing's own URL (or address) so upserts dedupe across runs.
function listingId(source: string, p: Property): string | null {
  const basis = p.source_url || `${p.address || ""}|${p.zip || p.city || ""}`;
  if (!basis.trim()) return null;
  return stableId(basis, source);
}

/** Parse a portal page's embedded listings (JSON-LD / __NEXT_DATA__) into HomeIQ Properties. */
export function parsePortalHtml(html: string, source: string): Property[] {
  const out: Property[] = [];
  for (const p of genericExtractProperties(html, source)) {
    const id = listingId(source, p);
    if (!id) continue;
    p.source_listing_id = id;
    out.push(p);
  }
  return out;
}

function urlsFor(env: string): string[] {
  return (process.env[env] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Harvest one portal's configured search pages (needs the fleet to clear anti-bot). */
export async function harvestPortal(
  source: string,
  urls: string[],
): Promise<Property[]> {
  if (!urls.length) return [];
  console.log(`[HomeIQ:${source}] harvesting ${urls.length} pages...`);
  const byId = new Map<string, Property>();
  for (const url of urls) {
    try {
      const { html, blocked } = await smartFetch(url, {
        validate: (h) => parsePortalHtml(h, source).length > 0,
      });
      if (blocked || !html) {
        console.warn(
          `[HomeIQ:${source}] blocked/empty: ${url} (needs a clean IP + headed tier)`,
        );
        continue;
      }
      for (const p of parsePortalHtml(html, source))
        byId.set(p.source_listing_id!, p);
    } catch (e) {
      console.warn(`[HomeIQ:${source}] ${url} failed:`, (e as Error).message);
    }
  }
  const properties = Array.from(byId.values());
  console.log(`[HomeIQ:${source}] found ${properties.length} listings`);
  return properties;
}

/** Harvest every configured listing portal. Each degrades to [] when unconfigured or anti-bot-blocked. */
export async function harvestPortals(): Promise<Property[]> {
  const results = await Promise.all(
    PORTALS.map((p) => harvestPortal(p.source, urlsFor(p.env)).catch(() => [])),
  );
  return results.flat();
}
