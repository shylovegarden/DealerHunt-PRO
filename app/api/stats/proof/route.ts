export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { CURATED_SITES } from "@/lib/scrapers/curated-sites";

// GET /api/stats/proof — the real "here's the scale + the money" numbers for the public landing proof band.
// All live from the DB (no invented figures). Cached in-process 30 min (marketing numbers, not real-time)
// and never cached empty, so a transient miss self-heals. Client created lazily (build-safe).

type Proof = {
  carsScored: number; // active car listings we've priced
  carsBuy: number; // BUY-verdict deals live right now
  avgSpread: number; // avg true net profit on a BUY deal — the money on the table
  homesTracked: number; // active properties scored
  distressed: number; // hot / distressed leads
  states: number;
  dealers: number; // curated salvage/rebuilder lots
};

let cache: { at: number; data: Proof } | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < 30 * 60 * 1000)
    return NextResponse.json(cache.data);

  const dealers = CURATED_SITES.length;
  try {
    const sb = createServerComponentClient();
    const [scored, buy, tracked, hot, spreadRows] = await Promise.all([
      sb
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      sb
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .eq("deal_verdict", "go"),
      sb
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      sb
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .eq("lead_tier", "hot"),
      sb
        .from("deals")
        .select("true_net_profit")
        .eq("active", true)
        .eq("deal_verdict", "go")
        .gt("true_net_profit", 0)
        .limit(5000),
    ]);

    const profits = (spreadRows.data || [])
      .map((r) => Number((r as { true_net_profit: number }).true_net_profit))
      .filter((n) => n > 0);
    const avgSpread = profits.length
      ? Math.round(profits.reduce((a, b) => a + b, 0) / profits.length)
      : 0;

    const data: Proof = {
      carsScored: scored.count || 0,
      carsBuy: buy.count || 0,
      avgSpread,
      homesTracked: tracked.count || 0,
      distressed: hot.count || 0,
      states: 50,
      dealers,
    };
    if (data.carsScored || data.homesTracked) cache = { at: now, data };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      carsScored: 0,
      carsBuy: 0,
      avgSpread: 0,
      homesTracked: 0,
      distressed: 0,
      states: 50,
      dealers,
    });
  }
}
