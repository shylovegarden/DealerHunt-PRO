// lib/housing/flood-enrich.ts
//
// Batch FEMA flood-zone enrichment — turns the detail-only flood lookup into a STORED, filterable field.
// Flood zone is static per parcel, so we enrich each property once and never re-query it. Runs bounded +
// hottest-first each harvest so the leads users actually see get flagged fast, accumulating full coverage
// over time. Best-effort + defensive: it MERGES into signals (never clobbers), only writes when FEMA gives
// a real answer, and any failure is isolated. Not in the pure scoring path (it does network + DB I/O).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { floodZone } from "./sources/fema-flood";

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
}

// Run `fn` over items with at most `n` in flight — keeps FEMA calls concurrent but bounded.
async function pooled<T>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(n, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx]);
      }
    },
  );
  await Promise.all(workers);
}

interface Row {
  id: string;
  lat: number | null;
  lng: number | null;
  signals: Record<string, unknown> | null;
}

/**
 * Enrich a bounded batch of not-yet-checked, geocoded properties with their FEMA flood zone (hottest first).
 * Stores `flood_zone` + `flood_high` into `signals`. Returns the count updated. No-op / 0 on any failure.
 */
export async function enrichFloodZones(limit = 800): Promise<number> {
  try {
    const sb = service();
    const { data, error } = await sb
      .from("properties")
      .select("id, lat, lng, signals")
      .eq("active", true)
      .not("lat", "is", null)
      .filter("signals->>flood_zone", "is", null) // never checked yet
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error || !data?.length) return 0;

    let updated = 0;
    await pooled(data as Row[], 12, async (r) => {
      const fz = await floodZone(r.lat, r.lng).catch(() => null);
      if (!fz) return; // unmapped / error → leave for a later pass (don't poison with a fake value)
      // MERGE into existing signals — never overwrite the whole blob.
      const merged = {
        ...(r.signals || {}),
        flood_zone: fz.zone,
        flood_high: fz.high,
      };
      const { error: upErr } = await sb
        .from("properties")
        .update({ signals: merged })
        .eq("id", r.id);
      if (!upErr) updated++;
    });
    console.log(`[flood] enriched ${updated}/${data.length}`);
    return updated;
  } catch (e) {
    console.warn("[flood] enrich skipped:", (e as Error).message);
    return 0;
  }
}
