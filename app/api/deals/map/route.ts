export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";

// GET /api/deals/map?verdict=go&limit= — geocoded active deals as map points for the deals map.
// Only returns rows that actually have coordinates (the map is meaningless without them).
const money = (v: any) => `$${Math.round(Number(v) || 0).toLocaleString()}`;

// Marker color encodes the verdict: GO = green ("private"), HOLD = amber ("auction"), else blue.
function typeForVerdict(v: string): "private" | "auction" | "dealer" {
  if (v === "go") return "private";
  if (v === "hold") return "auction";
  return "dealer";
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const verdict = sp.get("verdict") || "go";
  const limit = Math.min(
    2000,
    Math.max(1, parseInt(sp.get("limit") || "1000", 10) || 1000),
  );

  const supabase = createServerComponentClient();
  let q = supabase
    .from("deals")
    .select(
      "id, year, make, model, ask_price, true_net_profit, deal_verdict, lat, lng, location_city, location_state",
    )
    .eq("active", true)
    .not("lat", "is", null)
    .gt("ask_price", 0)
    .order("profit_score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (verdict && verdict !== "all") q = q.eq("deal_verdict", verdict);

  const { data, error } = await q;
  if (error)
    return NextResponse.json(
      { error: error.message, points: [] },
      { status: 500 },
    );

  const points = (data || []).map((d: any) => ({
    id: d.id,
    name: `${d.year} ${d.make} ${d.model}`.trim(),
    lat: Number(d.lat),
    lng: Number(d.lng),
    type: typeForVerdict(d.deal_verdict),
    label: `${money(d.ask_price)} · ${Number(d.true_net_profit) >= 0 ? "+" : ""}${money(d.true_net_profit)} profit${d.location_city ? ` · ${d.location_city}, ${d.location_state || ""}` : ""}`,
  }));

  return NextResponse.json({ points, count: points.length });
}
