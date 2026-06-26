export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";
import { categorize } from "@/lib/discovery/categorize";
import { haversineMiles } from "@/lib/geo/distance";

// GET /api/deals/near?verdict=go&radius= — closest deals to the dealer's geocoded home base.
// Unlocked by the geocoding work: reads home_lat/home_lng from the profile, computes haversine
// distance to every geocoded deal, returns them nearest-first in DiscoveryDeal shape (so the
// standard IntelRail/DiscoveryCard render it). $0 — pure math, no PostGIS RPC, no AI.
function mapDeal(d: any, distanceMiles: number) {
  const tags = categorize({ ...d, sellBasis: d.deal_analysis?.sellBasis });
  return {
    id: d.id,
    source: d.source,
    sourceUrl: d.source_url,
    sellerPhone: d.seller_phone,
    sellerEmail: d.seller_email,
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
    distanceMiles: Math.round(distanceMiles),
    winReason: `${Math.round(distanceMiles)} mi from you`,
  };
}

export async function GET(req: NextRequest) {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id) return NextResponse.json({ deals: [] });

  const supabase = createServerComponentClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("home_lat, home_lng")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.home_lat == null || profile?.home_lng == null) {
    // No geocoded home yet → the rail simply hides. Set a ZIP in Settings to enable it.
    return NextResponse.json({ deals: [], needsHome: true });
  }

  const sp = new URL(req.url).searchParams;
  const verdict = sp.get("verdict") || "go";
  const radius = Number(sp.get("radius")) || 0; // 0 = no cap

  let q = supabase
    .from("deals")
    .select(
      "id, source, source_url, title, year, make, model, vin, mileage, condition, ask_price, sell_estimate, deal_analysis, profit_score, true_net_profit, recommended_max_bid, deal_verdict, location_city, location_state, images, lat, lng",
    )
    .eq("active", true)
    .gt("ask_price", 0)
    .not("lat", "is", null)
    .limit(500);
  if (verdict && verdict !== "all") q = q.eq("deal_verdict", verdict);

  const { data: rows } = await q;

  const withDist: { d: any; miles: number }[] = [];
  for (const r of rows || []) {
    const miles = haversineMiles(
      Number(profile.home_lat),
      Number(profile.home_lng),
      Number(r.lat),
      Number(r.lng),
    );
    if (miles == null) continue;
    if (radius > 0 && miles > radius) continue;
    withDist.push({ d: r, miles });
  }
  withDist.sort((a, b) => a.miles - b.miles);

  const deals = withDist.slice(0, 24).map(({ d, miles }) => mapDeal(d, miles));
  return NextResponse.json({ deals });
}
