export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { STATE_COORDS } from "@/lib/geo";

// GET /api/deals/map?verdict=go&limit= — active deals as map points. Precise geocoded coords when we
// have them, else a STATE CENTROID fallback (with deterministic jitter so a state's deals spread out
// instead of stacking) — so the map reflects ALL located inventory, not just the ~18% geocoded yet.
const money = (v: any) => `$${Math.round(Number(v) || 0).toLocaleString()}`;

// Stable per-id offset in [-0.4, 0.4]° so centroid points don't collapse onto one marker.
function jitter(id: string, salt: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h + salt * 7919) % 1000) / 1000 - 0.5) * 0.8;
}

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
    // A point needs EITHER precise coords OR a state we can fall back to a centroid for.
    .or("lat.not.is.null,location_state.not.is.null")
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

  const points = (data || [])
    .map((d: any) => {
      let lat: number | null = null;
      let lng: number | null = null;
      let approx = false;
      if (d.lat != null && d.lng != null) {
        lat = Number(d.lat);
        lng = Number(d.lng);
      } else {
        const c = STATE_COORDS[(d.location_state || "").toUpperCase()];
        if (c) {
          lat = c.lat + jitter(d.id, 1);
          lng = c.lon + jitter(d.id, 2);
          approx = true;
        }
      }
      if (lat == null || lng == null) return null;
      return {
        id: d.id,
        name: `${d.year} ${d.make} ${d.model}`.trim(),
        lat,
        lng,
        approx,
        type: typeForVerdict(d.deal_verdict),
        label: `${money(d.ask_price)} · ${Number(d.true_net_profit) >= 0 ? "+" : ""}${money(d.true_net_profit)} profit${d.location_city ? ` · ${d.location_city}, ${d.location_state || ""}` : d.location_state ? ` · ${d.location_state}` : ""}`,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ points, count: points.length });
}
