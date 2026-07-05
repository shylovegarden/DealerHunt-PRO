export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { propertyStats } from "@/lib/housing/store";
import { aerialThumb } from "@/lib/housing/property-image";

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
  type FeedItem = {
    kind: "car" | "house";
    text: string; // title (address / year make model)
    sub: string; // "$X · ST" (kept for back-compat)
    loc: string; // "City, ST" — the prominent location line
    price: string; // formatted price
    image: string | null; // real photo, or a free aerial for off-market houses
  };
  let feed: FeedItem[] = [];
  try {
    const sb = createServerComponentClient();
    // Over-fetch so that after de-duping (many absentee records share an address/price) we still get variety.
    const [carRows, houseRows] = await Promise.all([
      sb
        .from("deals")
        .select(
          "year, make, model, ask_price, location_city, location_state, images",
        )
        .eq("active", true)
        .eq("deal_verdict", "go")
        .not("images", "is", null)
        .order("last_seen_at", { ascending: false })
        .limit(40),
      sb
        .from("properties")
        .select("address, city, state, price, images, lat, lng")
        .eq("active", true)
        .eq("lead_tier", "hot")
        .order("scraped_at", { ascending: false })
        .limit(60),
    ]);
    const money = (n?: number | null) =>
      n ? `$${Math.round(n).toLocaleString()}` : "";

    // De-dupe by text+price so the same listing never repeats down the scroll.
    const dedupe = (items: FeedItem[], cap: number) => {
      const seen = new Set<string>();
      const out: FeedItem[] = [];
      for (const it of items) {
        if (!it.text) continue;
        const key = `${it.text}|${it.sub}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(it);
        if (out.length >= cap) break;
      }
      return out;
    };

    const loc = (city?: string | null, state?: string | null) =>
      [city, state].filter(Boolean).join(", ");
    const cars_ = dedupe(
      (carRows.data || []).map((d) => ({
        kind: "car" as const,
        text: `${d.year || ""} ${d.make || ""} ${d.model || ""}`
          .replace(/\s+/g, " ")
          .trim(),
        sub: [money(d.ask_price), d.location_state].filter(Boolean).join(" · "),
        loc: loc(d.location_city, d.location_state),
        price: money(d.ask_price),
        image: Array.isArray(d.images) && d.images[0] ? d.images[0] : null,
      })),
      12,
    );
    const houses_ = dedupe(
      (houseRows.data || []).map((p) => ({
        kind: "house" as const,
        // Use the real street address (falls back to city/state) — never a source-derived title.
        text: (p.address || `${p.city || ""}, ${p.state || ""}`)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 40),
        sub: [money(p.price), p.state].filter(Boolean).join(" · "),
        loc: loc(p.city, p.state),
        price: money(p.price),
        // Real listing photo, else a free aerial of the exact parcel so every card has a visual.
        image:
          (Array.isArray(p.images) && p.images[0]) ||
          aerialThumb(p.lat, p.lng) ||
          null,
      })),
      12,
    );
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
