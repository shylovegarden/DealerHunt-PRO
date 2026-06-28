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
    ? { total: stats.total, hot: stats.byTier?.hot || 0 }
    : null;

  return NextResponse.json({ cars, houses });
}
