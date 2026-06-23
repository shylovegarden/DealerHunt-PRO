export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { loadProfitableMakes } from "@/lib/intelligence/profitable-segments";

// GET /api/system/status — the app's self-awareness: data freshness, per-source health (with
// self-heal flags), and data-quality coverage. Read-only; powers the status surface and lets the
// system (and the dealer) see whether it's running itself.
export async function GET() {
  const sb = createServerComponentClient();
  const since24 = new Date(Date.now() - 86400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();

  const countActive = (build: (q: any) => any) =>
    build(
      sb
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
    ).then((r: any) => r.count ?? 0);

  const [
    active,
    new24,
    new7,
    updated24,
    withVin,
    withImages,
    geocoded,
    withCity,
    go,
    health,
    recent,
    newest,
  ] = await Promise.all([
    countActive((q: any) => q),
    countActive((q: any) => q.gt("created_at", since24)),
    countActive((q: any) => q.gt("created_at", since7)),
    countActive((q: any) => q.gt("updated_at", since24)),
    countActive((q: any) => q.not("vin", "is", null).neq("vin", "")),
    countActive((q: any) => q.not("images", "is", null).neq("images", "{}")),
    countActive((q: any) => q.not("lat", "is", null)),
    countActive((q: any) => q.not("location_city", "is", null)),
    countActive((q: any) => q.eq("deal_verdict", "go")),
    sb
      .from("source_health")
      .select("*")
      .then((r: any) => r.data ?? []),
    sb
      .from("scrape_runs")
      .select("source, ok, deals_found, duration_ms, run_at")
      .order("run_at", { ascending: false })
      .limit(20)
      .then((r: any) => r.data ?? []),
    sb
      .from("deals")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r: any) => r.data?.created_at ?? null),
  ]);

  const pct = (n: number) => (active ? Math.round((n / active) * 100) : 0);
  const hoursSince = newest
    ? Math.round((Date.now() - new Date(newest).getTime()) / 3600_000)
    : null;

  // Closed-loop learning: makes the dealer has profited on that the pipeline now prioritizes.
  const [outcomesLogged, profitableMakes] = await Promise.all([
    sb
      .from("deal_outcomes")
      .select("id", { count: "exact", head: true })
      .then((r: any) => r.count ?? 0),
    loadProfitableMakes()
      .then((s) => Array.from(s))
      .catch(() => [] as string[]),
  ]);

  return NextResponse.json({
    learning: {
      outcomesLogged,
      prioritizedMakes: profitableMakes,
    },
    freshness: {
      activeDeals: active,
      newLast24h: new24,
      newLast7d: new7,
      updatedLast24h: updated24,
      newestAgeHours: hoursSince,
      stale: hoursSince == null || hoursSince > 24,
    },
    quality: {
      goDeals: go,
      vinPct: pct(withVin),
      imagePct: pct(withImages),
      geocodedPct: pct(geocoded),
      cityPct: pct(withCity),
    },
    sources: health,
    recentRuns: recent,
  });
}
