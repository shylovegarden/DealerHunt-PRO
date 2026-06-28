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

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
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
    scraped_at: p.scraped_at || new Date().toISOString(),
  };
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
  let rows = properties.filter((p) => p.source_listing_id).map(toRow);
  if (!rows.length) return 0;

  for (let heal = 0; heal < 6; heal++) {
    const { error } = await sb
      .from("properties")
      .upsert(rows, { onConflict: "source,source_listing_id" });
    if (!error) return rows.length;

    // Table absent → signal unavailable so the API harvests live instead.
    if (
      /relation .*properties.* does not exist|could not find the table/i.test(
        error.message,
      )
    )
      return -1;

    // Strip an unknown column and retry the batch (same trick the cars pipeline uses).
    const m = error.message.match(/column "?([a-z_]+)"?/i);
    if (m && rows[0] && m[1] in rows[0]) {
      const bad = m[1];
      rows = rows.map((r) => {
        const { [bad]: _drop, ...rest } = r as Record<string, unknown>;
        return rest;
      });
      continue;
    }
    console.warn("[upsertProperties] failed:", error.message);
    return 0;
  }
  return 0;
}

export interface PropertyQuery {
  state?: string;
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
  let query = sb
    .from("properties")
    .select("*")
    .eq("active", true)
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(Math.min(500, q.limit ?? 200));
  if (q.state) query = query.eq("state", q.state.toUpperCase());
  if (q.tier) query = query.eq("lead_tier", q.tier);
  if (q.source) query = query.eq("source", q.source);
  if (q.minScore != null) query = query.gte("lead_score", q.minScore);

  const { data, error } = await query;
  if (error) {
    if (/does not exist|could not find the table/i.test(error.message))
      return null;
    console.warn("[queryProperties] failed:", error.message);
    return null;
  }
  return (data as StoredProperty[]) || [];
}

/** Count properties grouped by state + tier (for the market dashboard). */
export async function propertyStats(): Promise<{
  total: number;
  byTier: Record<string, number>;
  byState: Record<string, number>;
} | null> {
  const rows = await queryProperties({ limit: 500 });
  if (rows == null) return null;
  const byTier: Record<string, number> = { hot: 0, warm: 0, standard: 0 };
  const byState: Record<string, number> = {};
  for (const r of rows) {
    if (r.lead_tier) byTier[r.lead_tier] = (byTier[r.lead_tier] || 0) + 1;
    if (r.state) byState[r.state] = (byState[r.state] || 0) + 1;
  }
  return { total: rows.length, byTier, byState };
}
