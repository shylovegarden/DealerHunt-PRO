export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";
import { categorize } from "@/lib/discovery/categorize";
import { extractWinPatterns, matchWin } from "@/lib/intelligence/win-patterns";

// GET /api/recommendations — "Deals like your winners". Learns the make/models THIS dealer has
// profited on (from logged outcomes) and surfaces active deals matching those patterns. Sharpens as
// more sales are logged. $0 — no AI, no embeddings round-trip.
function mapDeal(d: any, reason?: string) {
  const tags = categorize({ ...d, sellBasis: d.deal_analysis?.sellBasis });
  return {
    id: d.id,
    source: d.source,
    sourceUrl: d.source_url,
    title: d.title || `${d.year || ""} ${d.make || ""} ${d.model || ""}`.trim(),
    year: d.year,
    make: d.make,
    model: d.model,
    vin: d.vin,
    mileage: d.mileage,
    condition: d.condition,
    askPrice: Number(d.ask_price || 0),
    sellEstimate: d.sell_estimate != null ? Number(d.sell_estimate) : undefined,
    profitScore: d.profit_score != null ? Number(d.profit_score) : undefined,
    trueNetProfit:
      d.true_net_profit != null ? Number(d.true_net_profit) : undefined,
    recommendedMaxBid:
      d.recommended_max_bid != null ? Number(d.recommended_max_bid) : undefined,
    dealVerdict: d.deal_verdict,
    locationCity: d.location_city,
    locationState: d.location_state,
    images: d.images || [],
    ...tags,
    alsoOn: [],
    listingCount: 1,
    winReason: reason,
  };
}

export async function GET() {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id) return NextResponse.json({ deals: [], reason: "sign in" });

  const supabase = createServerComponentClient();

  const { data: outcomes } = await supabase
    .from("deal_outcomes")
    .select("make, model, actual_profit")
    .eq("user_id", user.id)
    .not("actual_profit", "is", null)
    .limit(200);

  const patterns = extractWinPatterns(outcomes || []);
  if (patterns.length === 0) {
    return NextResponse.json({
      deals: [],
      reason: "no profitable sales logged yet",
    });
  }

  const makes = Array.from(new Set(patterns.slice(0, 8).map((p) => p.make)));
  const { data: rows } = await supabase
    .from("deals")
    .select(
      "id, source, source_url, title, year, make, model, vin, mileage, condition, ask_price, sell_estimate, mmr_value, deal_analysis, profit_score, true_net_profit, recommended_max_bid, deal_verdict, location_city, location_state, images",
    )
    .eq("active", true)
    .gt("ask_price", 0)
    .in("make", makes)
    .order("profit_score", { ascending: false, nullsFirst: false })
    .limit(500);

  const seen = new Set<string>();
  const deals: any[] = [];
  for (const r of rows || []) {
    const m = matchWin(r.make, r.model, patterns);
    if (!m.matched || seen.has(r.id)) continue;
    seen.add(r.id);
    deals.push(
      mapDeal(
        r,
        `you've averaged ~$${m.avgProfit.toLocaleString()} on ${m.count} like this`,
      ),
    );
    if (deals.length >= 24) break;
  }

  return NextResponse.json({ deals, patterns: patterns.slice(0, 8) });
}
