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
import { configuredAreas } from "./redfin-gis";
import { activeStates } from "../active-states";
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

// {city, state} for the top metros (reuses the Redfin nationwide seed — "Atlanta GA" → Atlanta, GA).
// When `states` is given, only metros in those states are kept (demand-driven scope) — filter BEFORE the
// limit so we get the active states' metros, not the top-N-then-filtered remainder.
function metros(
  limit: number,
  states?: string[],
): { city: string; state: string }[] {
  const allow = states?.length
    ? new Set(states.map((s) => s.toUpperCase()))
    : null;
  return configuredAreas()
    .map((a) => {
      const parts = a.name.trim().split(/\s+/);
      const state = parts.pop() || "";
      return { city: parts.join(" "), state };
    })
    .filter((m) => m.city && m.state)
    .filter((m) => !allow || allow.has(m.state.toUpperCase()))
    .slice(0, limit);
}

const dash = (c: string) =>
  c.toLowerCase().replace(/\./g, "").replace(/\s+/g, "-");
const under = (c: string) => c.replace(/\./g, "").replace(/\s+/g, "-");

// Standard per-portal metro search-URL patterns (verified to resolve). Deterministic — NOT guessed IDs.
function defaultUrls(source: string, states?: string[]): string[] {
  const max = Math.max(
    0,
    parseInt(process.env.PORTAL_MAX_METROS || "10", 10) || 10,
  );
  return metros(max, states)
    .map(({ city, state }) => {
      const s = state.toLowerCase();
      switch (source) {
        case "zillow":
          return `https://www.zillow.com/${dash(city)}-${s}/`;
        case "realtor":
          return `https://www.realtor.com/realestateandhomes-search/${under(city)}_${state}`;
        case "homes":
          return `https://www.homes.com/${dash(city)}-${s}/`;
        case "movoto":
          return `https://www.movoto.com/${dash(city)}-${s}/`;
        case "trulia":
          return `https://www.trulia.com/${state}/${under(city)}/`;
        default:
          return "";
      }
    })
    .filter(Boolean);
}

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

/**
 * Harvest every listing portal. Uses hand-configured URLs (PORTAL env vars) when set, otherwise
 * auto-generates nationwide metro search URLs from the seed so portals go LIVE on the fleet with zero
 * config. Each degrades to [] when anti-bot-blocked (smartFetch cools a host after the first block, so an
 * off-fleet run fails fast rather than hammering). Catches the same MLS as Redfin PLUS portal-only stock
 * (Zillow FSBO, Realtor exclusives) that the gis-csv door doesn't carry.
 */
export async function harvestPortals(): Promise<Property[]> {
  // Demand-driven scope: auto-generated metro URLs are limited to the active states (MO+IL by default).
  // Explicit PORTAL env URLs still win (manual override).
  const states = await activeStates();
  const results = await Promise.all(
    PORTALS.map((p) => {
      const urls = urlsFor(p.env);
      return harvestPortal(
        p.source,
        urls.length ? urls : defaultUrls(p.source, states),
      ).catch(() => []);
    }),
  );
  return results.flat();
}
