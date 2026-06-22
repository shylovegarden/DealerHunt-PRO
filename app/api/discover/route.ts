export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";
import { categorize, auctionHeat } from "@/lib/discovery/categorize";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

// /api/discover — the meta-search/aggregator endpoint (CarGurus/Kayak style).
// Pulls active deals, MERGES duplicates of the same car across sources by VIN (cheapest wins,
// other listings attached), grades each vs market, and groups into categorized rails.

function mapDeal(
  d: any,
  alsoOn: { source: string; askPrice: number; url: string }[],
) {
  const tags = categorize({ ...d, sellBasis: d.deal_analysis?.sellBasis });
  const { heat, hoursLeft } = auctionHeat(d.auction_end_at);
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
    lastSeenAt: d.last_seen_at,
    auctionEndAt: d.auction_end_at,
    heat,
    hoursLeft: hoursLeft != null ? Math.round(hoursLeft * 10) / 10 : null,
    // discovery tags
    ...tags,
    // cross-source merge ("also found on N sites")
    alsoOn,
    listingCount: alsoOn.length + 1,
  };
}

export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(request, {
      key: "discover",
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.allowed) return tooManyRequests(rl);

    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state")?.toUpperCase();
    const maxPrice = parseInt(searchParams.get("maxPrice") || "0");

    const supabase = createServerComponentClient();
    let q = supabase
      .from("deals")
      .select(
        "id, source, source_url, title, year, make, model, trim, vin, mileage, condition, ask_price, sell_estimate, mmr_value, deal_analysis, profit_score, true_net_profit, recommended_max_bid, deal_verdict, location_city, location_state, images, last_seen_at, auction_end_at",
      )
      .eq("active", true)
      .gt("ask_price", 0)
      .order("last_seen_at", { ascending: false })
      .limit(5000);

    if (state) q = q.eq("location_state", state);
    if (maxPrice > 0) q = q.lte("ask_price", maxPrice);

    const { data, error } = await q;
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data || [];

    // ── Cross-source dedup by VIN (the Kayak mechanism) ──
    const byVin = new Map<string, any[]>();
    const noVin: any[] = [];
    for (const r of rows) {
      if (r.vin && String(r.vin).length === 17) {
        const k = String(r.vin).toUpperCase();
        if (!byVin.has(k)) byVin.set(k, []);
        byVin.get(k)!.push(r);
      } else {
        noVin.push(r);
      }
    }

    const merged: any[] = [];
    byVin.forEach((group) => {
      // Cheapest listing is the primary; the rest become "also on".
      group.sort((a, b) => Number(a.ask_price) - Number(b.ask_price));
      const [primary, ...rest] = group;
      merged.push(
        mapDeal(
          primary,
          rest.map((r) => ({
            source: r.source,
            askPrice: Number(r.ask_price || 0),
            url: r.source_url,
          })),
        ),
      );
    });
    for (const r of noVin) merged.push(mapDeal(r, []));

    // ── Categorized rails ──
    const byGradeRank: Record<string, number> = {
      great: 3,
      good: 2,
      fair: 1,
      high: 0,
      unknown: -1,
    };
    // Rail depth — generous so a large category isn't silently truncated to a handful. The UI rail
    // scrolls horizontally, so a deeper list just means more to swipe through, not a heavier page.
    const N = 60;

    const best = merged
      .filter((d) => d.grade === "great" || d.grade === "good")
      .sort((a, b) => b.discountPct - a.discountPct)
      .slice(0, N);

    const trucksSuvs = merged
      .filter((d) => d.segment === "truck" || d.segment === "suv")
      .sort(
        (a, b) =>
          byGradeRank[b.grade] - byGradeRank[a.grade] ||
          b.discountPct - a.discountPct,
      )
      .slice(0, N);

    const luxury = merged
      .filter(
        (d) => d.luxury || d.segment === "coupe" || d.segment === "convertible",
      )
      .sort((a, b) => byGradeRank[b.grade] - byGradeRank[a.grade])
      .slice(0, N);

    const budget = merged
      .filter((d) => d.priceTier === "budget")
      .sort(
        (a, b) =>
          byGradeRank[b.grade] - byGradeRank[a.grade] ||
          b.discountPct - a.discountPct,
      )
      .slice(0, N);

    const roi = merged
      .filter((d) => d.dealVerdict === "go" || d.dealVerdict === "hold")
      .sort((a, b) => (b.profitScore || 0) - (a.profitScore || 0))
      .slice(0, N);

    const ev = merged.filter((d) => d.segment === "ev").slice(0, N);

    // Distressed-seller feed (Priceline Express Deal analog) — motivated sellers below market.
    const distressed = merged
      .filter((d) => d.distressed)
      .sort(
        (a, b) =>
          byGradeRank[b.grade] - byGradeRank[a.grade] ||
          b.discountPct - a.discountPct,
      )
      .slice(0, N);

    // Flash / Ending Soon (Booking urgency) — auctions closing within 24h, soonest first.
    const flash = merged
      .filter((d) => d.heat === "hot" || d.heat === "warm")
      .sort((a, b) => (a.hoursLeft ?? 1e9) - (b.hoursLeft ?? 1e9))
      .slice(0, N);

    const fresh = [...merged]
      .sort(
        (a, b) =>
          new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
      )
      .slice(0, N);

    // ── Personalized "For You" rail (Booking/Kayak "your picks") ──
    // Reads the signed-in dealer's saved preferences — preferred states, budget, makes, min profit —
    // and surfaces matching deals first. Preferences were captured but never used; this wires them in.
    let forYou: any[] = [];
    let personalized = false;
    try {
      const {
        data: { user },
      } = await getServerUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "home_state, preferred_states, preferred_types, price_range_max, min_profit_target",
          )
          .eq("id", user.id)
          .maybeSingle();
        if (profile) {
          const states = new Set<string>(
            [...(profile.preferred_states || []), profile.home_state]
              .filter(Boolean)
              .map((s: string) => s.toUpperCase()),
          );
          const maxPrice = Number(profile.price_range_max) || 0;
          const minProfit = Number(profile.min_profit_target) || 0;
          const hasPrefs = states.size > 0 || maxPrice > 0 || minProfit > 0;
          if (hasPrefs) {
            personalized = true;
            forYou = merged
              .filter((d) => {
                if (
                  states.size > 0 &&
                  !states.has((d.locationState || "").toUpperCase())
                )
                  return false;
                if (maxPrice > 0 && d.askPrice > maxPrice) return false;
                if (minProfit > 0 && (d.trueNetProfit || 0) < minProfit)
                  return false;
                return true;
              })
              .sort(
                (a, b) =>
                  byGradeRank[b.grade] - byGradeRank[a.grade] ||
                  (b.profitScore || 0) - (a.profitScore || 0),
              )
              .slice(0, N);
          }
        }
      }
    } catch {
      // Anonymous / no profile — just skip personalization, feed still works.
    }

    const rails = [
      ...(forYou.length > 0
        ? [
            {
              key: "foryou",
              title: "⭐ For You",
              subtitle: "Matched to your states, budget & profit target",
              deals: forYou,
            },
          ]
        : []),
      {
        key: "flash",
        title: "⏳ Ending Soon",
        subtitle: "Auctions closing within 24h",
        deals: flash,
      },
      {
        key: "best",
        title: "Best Deals",
        subtitle: "Biggest discounts vs market",
        deals: best,
      },
      {
        key: "distressed",
        title: "Motivated Sellers",
        subtitle: "Repos, estates & must-sells below market",
        deals: distressed,
      },
      {
        key: "roi",
        title: "Top Flips",
        subtitle: "Highest profit potential",
        deals: roi,
      },
      {
        key: "trucks",
        title: "Trucks & SUVs",
        subtitle: "Highest-demand segment",
        deals: trucksSuvs,
      },
      {
        key: "budget",
        title: "Under $10k",
        subtitle: "Best value buys",
        deals: budget,
      },
      {
        key: "luxury",
        title: "Luxury & Performance",
        subtitle: "Premium picks",
        deals: luxury,
      },
      { key: "ev", title: "Electric", subtitle: "EVs & hybrids", deals: ev },
      {
        key: "fresh",
        title: "Just Listed",
        subtitle: "Freshly scraped",
        deals: fresh,
      },
    ].filter((r) => r.deals.length > 0);

    return NextResponse.json({
      rails,
      totalListings: rows.length,
      uniqueVehicles: merged.length,
      mergedDuplicates: rows.length - merged.length,
      state: state || "nationwide",
      personalized,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
