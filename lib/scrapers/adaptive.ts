// Adaptive scheduling: instead of round-robin shards, scrape the STALEST regions first — cities
// never scraped, or whose newest deal is oldest. Coverage self-optimizes toward whatever's gone
// cold. Pure ranking over deal freshness; returns Craigslist city subdomains to scrape this run.

import { createClient } from "@supabase/supabase-js";
import { CRAIGSLIST_SITES } from "@/lib/geo";

export async function selectStaleCities(count: number): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const sites: string[] = CRAIGSLIST_SITES.map((s) => s.site);
  if (sites.length === 0) return [];

  // Most-recent deal time per city (ordered desc → first occurrence per city is its freshest).
  const lastByCity = new Map<string, number>();
  try {
    const sb = createClient(url, key);
    const { data } = await sb
      .from("deals")
      .select("location_city, updated_at")
      .like("source", "craigslist%")
      .not("location_city", "is", null)
      .order("updated_at", { ascending: false })
      .limit(8000);
    for (const row of data || []) {
      const c = String(row.location_city).toLowerCase();
      if (!lastByCity.has(c))
        lastByCity.set(c, new Date(row.updated_at).getTime());
    }
  } catch {
    return []; // fail-open → caller falls back to shard rotation
  }

  // Rank: never-scraped first (Infinity staleness), then oldest-freshest first.
  const ranked = [...sites].sort((a, b) => {
    const la = lastByCity.has(a.toLowerCase())
      ? lastByCity.get(a.toLowerCase())!
      : -Infinity;
    const lb = lastByCity.has(b.toLowerCase())
      ? lastByCity.get(b.toLowerCase())!
      : -Infinity;
    return la - lb; // smaller (older / never) first
  });

  return ranked.slice(0, Math.max(1, count));
}
