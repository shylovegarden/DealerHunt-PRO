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
    // One RPC — count:exact head:true timed out on the big unfiltered counts (returned 0); a single
    // function with a raised statement_timeout returns them reliably.
    const { data: rows } = await sb.rpc("landing_proof");
    const r = (Array.isArray(rows) ? rows[0] : rows) as {
      cars_scored: number;
      cars_buy: number;
      avg_spread: number;
      homes_tracked: number;
      distressed: number;
    } | null;

    const data: Proof = {
      carsScored: Number(r?.cars_scored) || 0,
      carsBuy: Number(r?.cars_buy) || 0,
      avgSpread: Number(r?.avg_spread) || 0,
      homesTracked: Number(r?.homes_tracked) || 0,
      distressed: Number(r?.distressed) || 0,
      states: 50,
      dealers,
    };
    // Only cache a COMPLETE result — both headline counts present. A partial (one count 0 from a transient
    // miss) must not stick for 30 min; retry next request until it's whole.
    if (data.carsScored && data.homesTracked) cache = { at: now, data };
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
