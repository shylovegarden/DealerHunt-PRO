export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// GET /api/scan/facets?state=TX — returns only filter options that actually have live inventory, so
// the scan filters never offer a make/state/year that returns zero. Dynamic filters (Visor #7).
export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { key: "facets", limit: 60, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequests(rl);

  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state")?.toUpperCase();
  const supabase = createServerComponentClient();

  // Pull a wide active slice once, derive distinct facets in JS (cheaper than 3 distinct round-trips).
  let q = supabase
    .from("deals")
    .select("make, model, location_state, year")
    .eq("active", true)
    .gt("ask_price", 0)
    .not("make", "is", null)
    .limit(8000);
  if (state) q = q.eq("location_state", state);

  const { data, error } = await q;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const makes = new Map<string, number>();
  const models = new Map<string, number>();
  const states = new Set<string>();
  const years = new Set<number>();
  for (const r of data || []) {
    if (r.make) makes.set(r.make, (makes.get(r.make) || 0) + 1);
    if (r.model) models.set(r.model, (models.get(r.model) || 0) + 1);
    if (r.location_state) states.add(r.location_state);
    if (r.year) years.add(Number(r.year));
  }

  return NextResponse.json({
    // makes sorted by inventory volume (most-stocked first), with counts
    makes: Array.from(makes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([make, count]) => ({ make, count })),
    models: Array.from(models.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([model, count]) => ({ model, count })),
    states: Array.from(states).sort(),
    years: Array.from(years).sort((a, b) => b - a),
  });
}
