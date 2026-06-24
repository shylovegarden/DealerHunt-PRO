// Self-monitoring + self-healing for the scraper fleet. Every source's outcome is recorded to
// scrape_runs; the scheduler reads source_health to auto-skip sources that have failed their last
// few runs (with a cooldown so they retry periodically and recover automatically).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SourceRunResult {
  source: string;
  ok: boolean;
  dealsFound: number;
  durationMs?: number;
  error?: string;
}

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Do NOT fall back to anon key — scrape_runs has RLS and anon inserts are silently dropped.
    // If the service role key is missing, health records simply won't be written (best-effort).
    if (!key) console.warn("[Health] SUPABASE_SERVICE_ROLE_KEY not set — scrape_runs not recorded.");
    return null;
  }
  return createClient(url, key);
}

/** Record the outcome of each source in a run. Best-effort — never throws into the scrape path. */
export async function recordScrapeRuns(
  results: SourceRunResult[],
): Promise<void> {
  if (!results.length) return;
  const sb = admin();
  if (!sb) return;
  try {
    await sb.from("scrape_runs").insert(
      results.map((r) => ({
        source: r.source,
        ok: r.ok,
        deals_found: r.dealsFound ?? 0,
        duration_ms: r.durationMs ?? null,
        error: r.error ? String(r.error).slice(0, 500) : null,
      })),
    );
  } catch {
    /* health logging is non-fatal */
  }
}

/**
 * Sources to skip this run: those whose last 3 runs ALL failed and which were last attempted within
 * the cooldown window (so a dead source doesn't burn every run, but is retried every ~12h and can
 * heal itself once it starts working again). Returns an empty set on any error (fail-open).
 */
export async function getSkipSources(cooldownHours = 12): Promise<Set<string>> {
  const sb = admin();
  if (!sb) return new Set();
  try {
    const { data } = await sb
      .from("source_health")
      .select("source, last3_all_failed, last_run");
    const skip = new Set<string>();
    const cutoff = Date.now() - cooldownHours * 3600_000;
    for (const r of data || []) {
      if (
        r.last3_all_failed &&
        r.last_run &&
        new Date(r.last_run).getTime() > cutoff
      ) {
        skip.add(r.source);
      }
    }
    return skip;
  } catch {
    return new Set();
  }
}
