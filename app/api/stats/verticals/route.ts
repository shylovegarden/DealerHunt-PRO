export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { propertyStats } from "@/lib/housing/store";

// GET /api/stats/verticals — headline live counts for both verticals, for the /welcome selector.
// Cars: active deals + GO-verdict deals. Houses: total scored leads + hot tier. Public, read-only,
// count-only (no row data). Degrades to nulls if a table is missing so the selector never breaks.
export async function GET() {
  let cars: { active: number; go: number } | null = null;
  try {
    const sb = createServerComponentClient();
    const [active, go] = await Promise.all([
      sb
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      sb
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .eq("deal_verdict", "go"),
    ]);
    cars = { active: active.count || 0, go: go.count || 0 };
  } catch {
    cars = null;
  }

  const stats = await propertyStats().catch(() => null);
  const houses = stats
    ? {
        total: stats.total,
        hot: stats.byTier?.hot || 0,
        states: Object.keys(stats.byState || {}).filter(Boolean).length,
      }
    : null;

  // A few recent items from BOTH verticals for the live scrolling background feed on /welcome.
  type FeedItem = { kind: "car" | "house"; text: string; sub: string };
  let feed: FeedItem[] = [];
  try {
    const sb = createServerComponentClient();
    const [carRows, houseRows] = await Promise.all([
      sb
        .from("deals")
        .select("year, make, model, ask_price, location_state")
        .eq("active", true)
        .eq("deal_verdict", "go")
        .order("last_seen_at", { ascending: false })
        .limit(10),
      sb
        .from("properties")
        .select("title, city, state, price")
        .eq("active", true)
        .eq("lead_tier", "hot")
        .order("scraped_at", { ascending: false })
        .limit(10),
    ]);
    const money = (n?: number | null) =>
      n ? `$${Math.round(n).toLocaleString()}` : "";
    const cars_: FeedItem[] = (carRows.data || []).map((d) => ({
      kind: "car",
      text: `${d.year || ""} ${d.make || ""} ${d.model || ""}`
        .replace(/\s+/g, " ")
        .trim(),
      sub: [money(d.ask_price), d.location_state].filter(Boolean).join(" · "),
    }));
    const houses_: FeedItem[] = (houseRows.data || []).map((p) => ({
      kind: "house",
      text: (p.title || `${p.city || ""}, ${p.state || ""}`).slice(0, 42),
      sub: [money(p.price), p.state].filter(Boolean).join(" · "),
    }));
    // Interleave so the feed alternates houses/cars.
    for (let i = 0; i < Math.max(cars_.length, houses_.length); i++) {
      if (houses_[i]) feed.push(houses_[i]);
      if (cars_[i]) feed.push(cars_[i]);
    }
  } catch {
    feed = [];
  }

  return NextResponse.json({ cars, houses, feed });
}
