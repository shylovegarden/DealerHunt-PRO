// lib/housing/store.ts
//
// HomeIQ's data layer — the housing twin of lib/scrapers/pipeline.ts. Persists scored Properties to the
// `properties` table so the dashboard reads instantly (no live harvest per request) and supports
// state/tier/score browsing across the whole market. Best-effort + self-healing: if the table or a
// column is missing it degrades gracefully (the API falls back to a live harvest), never throws into a
// request. Writes use the service role (bypasses RLS), exactly like the cars upsert.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "./types";
import { scoreHousingLead } from "./lead-score";
import { resolvePlaces, placeKey } from "@/lib/geo/geocode";
import { normalizeAddress } from "./address-normalize";
import { fetchAllRows } from "@/lib/db/paginate";
import { US_STATES } from "./us-states";

/**
 * Cross-source structural enrichment — the "no data wasted" merge. The SAME physical house arrives from
 * multiple sources in one harvest: a Redfin listing (sqft/beds/baths/year/geo), a tax-delinquent record
 * (owner, amount owed), a vacant-building report (vacancy). Each carries facts the others lack. Before
 * scoring, we fill each row's MISSING structural fields from a sibling at the same address — so a distress
 * lead that had no sqft borrows it from its MLS twin and becomes flip-analyzable (gets ARV + equity), and a
 * bare MLS listing inherits the distress flags. Mutates in place. Rows stay separate (each is its own lead);
 * only the facts are shared. This is what turns "we harvested it somewhere" into "every lead benefits."
 */
export function crossEnrich(props: Property[]): number {
  const byAddr = new Map<string, Property[]>();
  for (const p of props) {
    const key = normalizeAddress(p.address, p.city, p.state, p.zip);
    if (!key) continue;
    const g = byAddr.get(key);
    if (g) g.push(p);
    else byAddr.set(key, [p]);
  }
  let enriched = 0;
  const first = <T>(
    g: Property[],
    pick: (p: Property) => T | null | undefined,
  ) => g.map(pick).find((v) => v != null && v !== "");
  for (const g of Array.from(byAddr.values())) {
    if (g.length < 2) continue;
    const best = {
      sqft: first(g, (p) => p.sqft),
      beds: first(g, (p) => p.beds),
      baths: first(g, (p) => p.baths),
      year_built: first(g, (p) => p.year_built),
      lot_size_acres: first(g, (p) => p.lot_size_acres),
      lat: first(g, (p) => p.lat),
      lng: first(g, (p) => p.lng),
      // Distress signals worth sharing onto a bare listing of the same house.
      owner: first(g, (p) => (p.signals as any)?.owner),
    };
    for (const p of g) {
      let touched = false;
      const fill = <K extends keyof Property>(
        k: K,
        v: Property[K] | undefined,
      ) => {
        if (p[k] == null && v != null) {
          p[k] = v as Property[K];
          touched = true;
        }
      };
      if (p.property_type !== "land") {
        fill("sqft", best.sqft as number | undefined);
        fill("beds", best.beds as number | undefined);
        fill("baths", best.baths as number | undefined);
        fill("year_built", best.year_built as number | undefined);
      }
      fill("lot_size_acres", best.lot_size_acres as number | undefined);
      fill("lat", best.lat as number | undefined);
      fill("lng", best.lng as number | undefined);
      if (touched) {
        p.signals = { ...(p.signals || {}), cross_enriched: true };
        enriched++;
      }
    }
  }
  return enriched;
}

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
}

// Owner → portfolio size (owners holding >=5 active properties), cached 15 min. Powers the "portfolio
// owner / institutional landlord" triage signal — public county-record ownership rolled up. Non-fatal:
// degrades to an empty map on any error, so leads never break if the aggregate is unavailable.
let _ownerPortfolio: { at: number; map: Map<string, number> } | null = null;
// Bounded retry for the matview RPCs on the hot leads path — a transient PostgREST hiccup (schema-cache
// lag right after a migration, a brief timeout) shouldn't blank owner-portfolio or state-count data.
// Retries with a short linear backoff, treats error OR empty as retryable, and never throws.
async function rpcRows<T>(
  call: () => PromiseLike<{ data: unknown; error: unknown }>,
  tries = 3,
): Promise<T[]> {
  for (let i = 0; i < tries; i++) {
    try {
      const { data, error } = await call();
      if (!error && Array.isArray(data) && data.length) return data as T[];
    } catch {
      /* fall through to retry */
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 150 * (i + 1)));
  }
  return [];
}

export async function ownerPortfolioMap(): Promise<Map<string, number>> {
  const now = Date.now();
  if (_ownerPortfolio && now - _ownerPortfolio.at < 15 * 60 * 1000)
    return _ownerPortfolio.map;
  const map = new Map<string, number>();
  // Parameterless RPC (matches dealer_inventory, which resolves reliably in prod), with bounded retry.
  const rows = await rpcRows<{ owner: string; cnt: number }>(() =>
    service().rpc("owner_portfolios"),
  );
  for (const r of rows) if (r.owner) map.set(String(r.owner), Number(r.cnt));
  // Only cache a NON-empty result — a transient RPC failure (e.g. PostgREST schema-cache lag right after
  // the migration) must not stick for the full TTL; retry on the next call until it populates.
  if (map.size) _ownerPortfolio = { at: now, map };
  return map;
}

// Sources where the "owner" is a disposition entity that IS selling (HUD, land banks, GSA, Fannie) — a
// portfolio count there is redundant with the source label AND misleading (they sell), so don't stamp it.
// The flag is meant for private HOLDERS (Invitation Homes, LLC rental portfolios) = "not a motivated seller".
export const DISPOSITION_SOURCES = new Set([
  "hud",
  "hud_reo",
  "land_bank",
  "fannie_homepath",
  "gsa_realestate",
  "gov_auction",
]);

/** Stamp `ownerCount` on any lead whose owner is a portfolio holder (>=5), skipping disposition sources.
 *  Shared by every read path so the owner-portfolio signal is identical everywhere. */
export async function stampOwnerPortfolio(
  leads: {
    source?: string | null;
    owner?: string | null;
    ownerCount?: number;
  }[],
): Promise<void> {
  const map = await ownerPortfolioMap();
  if (!map.size) return;
  for (const l of leads) {
    if (l.source && DISPOSITION_SOURCES.has(l.source)) continue;
    const n = l.owner ? map.get(l.owner) : undefined;
    if (n && n >= 5) l.ownerCount = n;
  }
}

function toRow(p: Property): Record<string, unknown> {
  const lead = scoreHousingLead(p);
  return {
    source: p.source,
    source_listing_id: p.source_listing_id,
    source_url: p.source_url,
    title: p.title,
    property_type: p.property_type,
    description: p.description,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    lat: p.lat,
    lng: p.lng,
    price: p.price,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    lot_size_acres: p.lot_size_acres,
    year_built: p.year_built,
    images: p.images,
    seller: p.seller,
    seller_type: p.seller_type,
    auction_end: p.auction_end,
    bid_count: p.bid_count,
    lead_score: lead.score,
    lead_tier: lead.tier,
    signals: { ...(p.signals || {}), reasons: lead.signals },
    active: true,
    // last_seen_at advances on EVERY harvest so the prune can tell live from delisted; scraped_at keeps the
    // first-content timestamp where available. (Self-heals if the column predates the freshness migration.)
    last_seen_at: new Date().toISOString(),
    scraped_at: p.scraped_at || new Date().toISOString(),
  };
}

/**
 * Reconcile freshness: mark anything not re-seen in `staleDays` inactive (the read paths filter active=true,
 * so it vanishes from counts + leads). Mirrors the cars 30-day prune. Best-effort + isolated — a missing
 * `last_seen_at` column (pre-migration) or any error just no-ops, never breaking the harvest.
 */
export async function reconcileStaleProperties(
  staleDays = 21,
): Promise<number> {
  try {
    const sb = service();
    const cutoff = new Date(Date.now() - staleDays * 86_400_000).toISOString();
    const { data, error } = await sb
      .from("properties")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("active", true)
      .lt("last_seen_at", cutoff)
      .select("id");
    if (error) {
      console.warn("[reconcileStale] skipped:", error.message);
      return 0;
    }
    const n = data?.length || 0;
    if (n) console.log(`[reconcileStale] marked ${n} stale listings inactive`);
    return n;
  } catch (e) {
    console.warn("[reconcileStale] skipped:", (e as Error).message);
    return 0;
  }
}

/**
 * Upsert scored properties. Returns the count written, or -1 when the store is unavailable (table
 * missing / not configured) so the caller can fall back to a live harvest. Self-heals unknown columns.
 */
export async function upsertProperties(
  properties: Property[],
): Promise<number> {
  if (!properties.length) return 0;
  const sb = service();
  // Share facts across sources at the same address BEFORE scoring, so distress leads inherit MLS sqft (and
  // gain ARV/equity) and listings inherit distress flags. Nothing harvested is wasted.
  const enriched = crossEnrich(properties);
  if (enriched)
    console.log(`[upsertProperties] cross-enriched ${enriched} rows`);
  let rows = properties.filter((p) => p.source_listing_id).map(toRow);
  if (!rows.length) return 0;

  // Dedup by the conflict key — a single upsert can't touch the same (source, source_listing_id) twice
  // ("ON CONFLICT DO UPDATE command cannot affect row a second time"), which was silently zeroing whole
  // harvests. Last occurrence wins.
  {
    const seen = new Map<string, (typeof rows)[number]>();
    for (const r of rows) seen.set(`${r.source}|${r.source_listing_id}`, r);
    rows = Array.from(seen.values());
  }

  // Geocode each property's location (free Nominatim/Zippopotam, cached in the SHARED geocode_cache) so
  // the HomeIQ map plots precise pins instead of a state centroid. Best-effort: failures leave lat/lng
  // null (the API falls back to a jittered centroid). Same pattern as the cars pipeline.
  try {
    const coords = await resolvePlaces(
      sb,
      rows.map((r) => ({
        zip: r.zip as string,
        city: r.city as string,
        state: r.state as string,
      })),
    );
    if (coords.size > 0) {
      for (const r of rows) {
        if (r.lat != null && r.lng != null) continue;
        const key = placeKey({
          zip: r.zip as string,
          city: r.city as string,
          state: r.state as string,
        });
        const c = key ? coords.get(key) : undefined;
        if (c) {
          r.lat = c.lat;
          r.lng = c.lng;
        }
      }
    }
  } catch (e) {
    console.warn("[upsertProperties] geocoding skipped:", (e as Error).message);
  }

  // Upsert in CHUNKS — a 60k-row single request exceeds payload limits. Each chunk self-heals an unknown
  // column (the cars-pipeline trick) and a missing table short-circuits the whole run.
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    let batch = rows.slice(i, i + CHUNK);
    for (let heal = 0; heal < 6; heal++) {
      const { error } = await sb
        .from("properties")
        .upsert(batch, { onConflict: "source,source_listing_id" });
      if (!error) {
        written += batch.length;
        break;
      }
      // Table absent → signal unavailable so the API harvests live instead.
      if (
        /relation .*properties.* does not exist|could not find the table/i.test(
          error.message,
        )
      )
        return -1;
      // Strip an unknown column and retry this batch.
      const m = error.message.match(/column "?([a-z_]+)"?/i);
      if (m && batch[0] && m[1] in batch[0]) {
        const bad = m[1];
        batch = batch.map((r) => {
          const { [bad]: _drop, ...rest } = r as Record<string, unknown>;
          return rest;
        });
        continue;
      }
      console.warn("[upsertProperties] batch failed:", error.message);
      break;
    }
  }

  // Instant deal alerts: match the just-harvested properties against saved searches and notify on NEW
  // hot/warm matches. Best-effort + isolated (lazy-imported so it never weighs on the hot read path).
  if (written > 0) {
    try {
      const { matchHousingSearches } = await import("./match-searches");
      await matchHousingSearches(properties);
    } catch (e) {
      console.warn(
        "[upsertProperties] alert match skipped:",
        (e as Error).message,
      );
    }
  }
  return written;
}

export interface PropertyQuery {
  state?: string;
  states?: string[]; // scope to several states (the "nearby" view) via a server-side IN filter
  tier?: string;
  source?: string;
  minScore?: number;
  limit?: number;
}

export interface StoredProperty extends Property {
  lead_score?: number;
  lead_tier?: string;
}

/**
 * Read scored properties hottest-first. Returns null when the store is unavailable (so the API can fall
 * back to a live harvest). An empty array means "store is there but empty" (trigger a harvest).
 */
export async function queryProperties(
  q: PropertyQuery = {},
): Promise<StoredProperty[] | null> {
  const sb = service();
  const want = Math.min(3000, q.limit ?? 200);
  // PostgREST caps a single response at 1000 rows, so page with .range() until we have `want` (or the
  // table is exhausted). Without this the lower-scored tail — e.g. land-bank lots beyond row 1000 — is
  // unreachable, so a source/state filter over the result would silently miss rows.
  const PAGE = 1000;
  const states = q.states?.map((s) => s.toUpperCase()).filter(Boolean);
  const out: StoredProperty[] = [];
  for (let offset = 0; offset < want; offset += PAGE) {
    let data: unknown = null;
    let error: { message: string } | null = null;
    // Retry a page on a TRANSIENT failure (a statement timeout on a cold DB connection) instead of letting
    // one flaky page collapse the whole scope to null/partial — the intermittent "0 leads on a big state"
    // bug. The query builder is single-use, so rebuild it each attempt.
    for (let attempt = 0; attempt < 3; attempt++) {
      let query = sb.from("properties").select("*").eq("active", true);
      if (states?.length) query = query.in("state", states);
      else if (q.state) query = query.eq("state", q.state.toUpperCase());
      if (q.tier) query = query.eq("lead_tier", q.tier);
      if (q.source) query = query.eq("source", q.source);
      if (q.minScore != null) query = query.gte("lead_score", q.minScore);
      const res = await query
        .order("lead_score", { ascending: false, nullsFirst: false })
        .order("source_listing_id", { ascending: true }) // stable tiebreak across pages
        .range(offset, Math.min(want, offset + PAGE) - 1);
      data = res.data;
      error = res.error;
      if (!error) break;
      // A missing table/column won't fix itself — bail immediately, don't waste retries.
      if (/does not exist|could not find the table/i.test(error.message))
        return offset === 0 ? null : out;
      if (attempt < 2)
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    if (error) {
      console.warn("[queryProperties] failed after retries:", error.message);
      return offset === 0 ? null : out;
    }
    const rows = (data as StoredProperty[]) || [];
    out.push(...rows);
    if (rows.length < PAGE) break; // last page
  }
  return out;
}

/**
 * Accurate per-state lead counts across the WHOLE table (one small column, paged past the 1000-cap) — so
 * the scope selector reflects all 54k, not just whatever made a top-N slice. Cache the result upstream.
 */
export async function countByState(): Promise<Record<string, number>> {
  // Reads the precomputed property_state_counts_mv (via a parameterless RPC, refreshed by pg_cron every
  // 30 min). The old path scanned every active row's state per request — a full GROUP BY over ~930k rows
  // that hit 50s once the visibility map went stale from harvest churn, timing out the whole leads API.
  const sb = service();
  const counts: Record<string, number> = {};
  const rows = await rpcRows<{ state: string; cnt: number }>(() =>
    sb.rpc("property_state_counts"),
  );
  for (const r of rows)
    if (r.state) counts[String(r.state).toUpperCase()] = Number(r.cnt);
  return counts;
}

/** Fetch one property by its source_listing_id (for the lead-detail page). Null if absent/unavailable. */
export async function getProperty(
  sourceListingId: string,
): Promise<StoredProperty | null> {
  if (!sourceListingId) return null;
  const sb = service();
  const { data, error } = await sb
    .from("properties")
    .select("*")
    .eq("source_listing_id", sourceListingId)
    .limit(1)
    .maybeSingle();
  if (error) {
    if (/does not exist|could not find the table/i.test(error.message))
      return null;
    console.warn("[getProperty] failed:", error.message);
    return null;
  }
  return (data as StoredProperty) || null;
}

/** Count properties grouped by state + tier (for the market dashboard). */
export async function propertyStats(): Promise<{
  total: number;
  byTier: Record<string, number>;
  byState: Record<string, number>;
} | null> {
  // Real totals from the fast matviews (property_stats_mv + property_state_counts_mv, pg_cron-refreshed) —
  // NOT a 2000-row sample, which capped "total" at 2000, showed a timed-out partial (214), and saw only the
  // handful of states present in that slice. This is what lets the landing show the true 1M+ tracked / 42k
  // hot / ~50 states instead of undercounting itself by ~4000x.
  const sb = service();
  const [statsRows, stateRows] = await Promise.all([
    rpcRows<{ total: number; hot: number; warm: number }>(() =>
      sb.rpc("property_stats"),
    ),
    rpcRows<{ state: string; cnt: number }>(() =>
      sb.rpc("property_state_counts"),
    ),
  ]);
  const s = statsRows[0];
  if (!s) return null;
  const byState: Record<string, number> = {};
  for (const r of stateRows) {
    const code = String(r.state || "").toUpperCase();
    // Real US states/DC only — drop the stray full-name ("CALIFORNIA") + province ("ON") keys.
    if (US_STATES[code]) byState[code] = Number(r.cnt);
  }
  return {
    total: Number(s.total),
    byTier: { hot: Number(s.hot), warm: Number(s.warm), standard: 0 },
    byState,
  };
}
