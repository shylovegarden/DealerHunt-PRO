export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";

// /api/insights/source-roi — DealerHunt-exclusive moat. From the dealer's OWN logged outcomes,
// answer the two questions no listing site can: which acquisition SOURCE (copart, fb, auction…)
// actually nets them money, and which exit CHANNEL (lot, carmax, private…) sells fastest and best.
// Pure aggregation over deal_outcomes — no AI, no external calls. Empty until they log deals.

interface Bucket {
  key: string;
  deals: number;
  totalProfit: number;
  wins: number;
  daysSum: number;
  daysN: number;
}

function emptyBucket(key: string): Bucket {
  return { key, deals: 0, totalProfit: 0, wins: 0, daysSum: 0, daysN: 0 };
}

function summarize(map: Map<string, Bucket>) {
  return Array.from(map.values())
    .map((b) => ({
      key: b.key,
      deals: b.deals,
      totalProfit: Math.round(b.totalProfit),
      avgProfit: b.deals ? Math.round(b.totalProfit / b.deals) : 0,
      winRate: b.deals ? Math.round((b.wins / b.deals) * 100) : 0,
      avgDays: b.daysN ? Math.round(b.daysSum / b.daysN) : null,
    }))
    .sort((a, b) => b.avgProfit - a.avgProfit);
}

export async function GET() {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ bySource: [], byChannel: [], totalDeals: 0 });

  const supabase = createServerComponentClient();
  const { data: outcomes } = await supabase
    .from("deal_outcomes")
    .select(
      "deal_id, actual_profit, sell_price, purchase_price, days_to_sell, sold_where",
    )
    .eq("user_id", user.id);

  const rows = outcomes ?? [];
  if (rows.length === 0)
    return NextResponse.json({ bySource: [], byChannel: [], totalDeals: 0 });

  // Resolve acquisition source for any outcome tied to a scraped deal.
  const dealIds = Array.from(
    new Set(rows.map((r: any) => r.deal_id).filter(Boolean)),
  );
  const sourceById = new Map<string, string>();
  if (dealIds.length) {
    const { data: deals } = await supabase
      .from("deals")
      .select("id, source")
      .in("id", dealIds);
    for (const d of deals ?? []) sourceById.set(d.id, d.source || "unknown");
  }

  const bySource = new Map<string, Bucket>();
  const byChannel = new Map<string, Bucket>();

  for (const r of rows as any[]) {
    // Profit: prefer logged actual_profit; fall back to sell - purchase when present.
    const profit =
      r.actual_profit != null
        ? Number(r.actual_profit)
        : r.sell_price != null && r.purchase_price != null
          ? Number(r.sell_price) - Number(r.purchase_price)
          : null;
    if (profit == null || !Number.isFinite(profit)) continue;

    const src = r.deal_id ? sourceById.get(r.deal_id) || "unknown" : "manual";
    const chan = (r.sold_where || "").trim().toLowerCase() || "unspecified";

    for (const [map, key] of [
      [bySource, src],
      [byChannel, chan],
    ] as [Map<string, Bucket>, string][]) {
      if (!map.has(key)) map.set(key, emptyBucket(key));
      const b = map.get(key)!;
      b.deals++;
      b.totalProfit += profit;
      if (profit > 0) b.wins++;
      if (r.days_to_sell != null) {
        b.daysSum += Number(r.days_to_sell);
        b.daysN++;
      }
    }
  }

  return NextResponse.json({
    bySource: summarize(bySource),
    byChannel: summarize(byChannel),
    totalDeals: rows.length,
  });
}
