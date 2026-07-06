export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";

// GET /api/feed?offset=0&limit=15 — a flat, PHOTO-FIRST, ranked stream for the full-screen TikTok-style
// deal feed. Only active, in-stock, photo-having cars (the feed is visual), best deals first, paginated for
// infinite scroll. $0 — one indexed query per page.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 15, 1), 30);
  const state = sp.get("state")?.toUpperCase();

  const supabase = createServerComponentClient();
  let q = supabase
    .from("deals")
    .select(
      "id, source, source_url, title, year, make, model, ask_price, sell_estimate, true_net_profit, profit_score, deal_verdict, location_city, location_state, images, mileage, condition, deal_analysis",
    )
    .eq("active", true)
    .gt("ask_price", 0)
    .not("images", "is", null)
    .order("profit_score", { ascending: false, nullsFirst: false })
    .order("last_seen_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (state) q = q.eq("location_state", state);

  const { data, error } = await q;
  if (error)
    return NextResponse.json({
      items: [],
      nextOffset: offset,
      error: error.message,
    });

  const items = (data || [])
    .filter((d: any) => Array.isArray(d.images) && d.images[0])
    .map((d: any) => ({
      id: d.id,
      source: d.source,
      sourceUrl: d.source_url,
      title:
        d.title || `${d.year || ""} ${d.make || ""} ${d.model || ""}`.trim(),
      year: d.year,
      make: d.make,
      model: d.model,
      image: d.images[0],
      askPrice: Number(d.ask_price || 0),
      sellEstimate: d.sell_estimate != null ? Number(d.sell_estimate) : null,
      netProfit: d.true_net_profit != null ? Number(d.true_net_profit) : null,
      score: d.profit_score != null ? Number(d.profit_score) : null,
      verdict: d.deal_verdict,
      mileage: d.mileage,
      condition: d.condition,
      locationCity: d.location_city,
      locationState: d.location_state,
      prediction: d.deal_analysis?.prediction ?? null,
    }));

  return NextResponse.json({ items, nextOffset: offset + limit });
}
