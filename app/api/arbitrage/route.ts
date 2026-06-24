import { NextRequest, NextResponse } from "next/server";
import { DealsService } from "@/lib/data/deals-service";
import { milesBetweenStates, transportCostForMiles } from "@/lib/geo";

// Geographic arbitrage from REAL data — no hardcoded regional price tables. For a dealer in
// `homeState`, every out-of-state deal is scored as: would importing it pay off? We use the deal's
// own engine resale estimate (sell_estimate, built from real comps/baseline), the real road distance
// to the dealer's state, and a selling-cost load. An opportunity is a deal that still nets a worthwhile
// profit AFTER the transport to bring it home. Honest: a deal with no resale estimate is skipped, not
// guessed.

const SELL_COST_PCT = 0.09; // selling + recon-to-retail load, as a fraction of resale
const MIN_PROFIT = 1500; // worth a cross-state haul

export async function GET(request: NextRequest) {
  try {
    const homeState = (
      request.nextUrl.searchParams.get("homeState") || "CA"
    ).toUpperCase();

    const dealsService = new DealsService();
    // Pull a healthy slice of fresh inventory to scan for import opportunities.
    const { deals } = await dealsService.getDeals({
      limit: 200,
      sortBy: "lastSeenAt",
      sortOrder: "desc",
    });

    const localDeals: any[] = [];
    const national: Array<{ deal: any; arbitrage: any }> = [];
    const routeAgg = new Map<
      string,
      { miles: number; cost: number; count: number; profit: number }
    >();

    for (const deal of deals) {
      const src = (deal.locationState || "").toUpperCase();
      if (!src) continue;
      if (src === homeState) {
        localDeals.push(deal);
        continue;
      }

      const ask = Number(deal.askPrice) || 0;
      const resale = Number(deal.sellEstimate) || 0;
      // Skip deals we can't back with a real resale number, or that the engine already rejected.
      if (ask <= 0 || resale <= 0 || deal.dealVerdict === "pass") continue;

      const miles = milesBetweenStates(src, homeState);
      if (miles == null) continue;
      const transport = transportCostForMiles(miles);
      const sellingCost = Math.round(resale * SELL_COST_PCT);
      const potentialProfit = Math.round(
        resale - ask - transport - sellingCost,
      );
      if (potentialProfit < MIN_PROFIT) continue;

      const profitMargin = Math.round((potentialProfit / ask) * 100);
      national.push({
        deal,
        // Nested shape kept for the /find render contract.
        arbitrage: {
          targetRegion: { state: homeState },
          sourceState: src,
          arbitrage: {
            sourcePrice: ask,
            targetPrice: resale,
            transportCost: transport,
            potentialProfit,
            profitMargin,
            distance: miles,
          },
        },
      });

      const r = routeAgg.get(src) || {
        miles,
        cost: transport,
        count: 0,
        profit: 0,
      };
      r.count += 1;
      r.profit += potentialProfit;
      routeAgg.set(src, r);
    }

    national.sort(
      (a, b) =>
        b.arbitrage.arbitrage.potentialProfit -
        a.arbitrage.arbitrage.potentialProfit,
    );

    // Real top routes: the source states actually producing the best import opportunities.
    const topRoutes = Array.from(routeAgg.entries())
      .map(([state, r]) => ({
        targetState: state,
        route: [state, homeState],
        distance: r.miles,
        estimatedCost: r.cost,
        estimatedTime: Math.max(1, Math.round(r.miles / 550)), // ~days at 550 mi/day
        opportunities: r.count,
        totalProfit: r.profit,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 6);

    return NextResponse.json({
      homeState,
      topRoutes,
      localDeals: localDeals.slice(0, 50),
      nationalArbitrage: national.slice(0, 15),
    });
  } catch (error: any) {
    console.error("Error fetching arbitrage dashboard data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
