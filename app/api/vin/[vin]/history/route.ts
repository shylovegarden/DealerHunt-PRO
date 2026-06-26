export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  fetchNmvtis,
  sightingsToHistory,
  type VinHistory,
} from "@/lib/vehicle/vin-history";
import { createServerComponentClient } from "@/lib/supabase";

// GET /api/vin/{vin}/history — server tiers:
//   • VIN GRAPH (free, unique): cross-reference the VIN against our own multi-channel scrape records.
//     If we ever saw it at a salvage auction or listed branded/damaged, that's a real flag no
//     single-site report has — and it compounds as we scrape more.
//   • NMVTIS (key-gated): authoritative title brands/total-loss when VINAUDIT_KEY is set.
// The free listing-text tier is merged client-side. We always return SOMETHING useful.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ vin: string }> },
) {
  const { vin } = await ctx.params;
  if (!vin || vin.length !== 17)
    return NextResponse.json({ authoritative: false, source: "none" });

  // Tier 1.5 — our own VIN graph.
  let graph: VinHistory | null = null;
  try {
    const sb = createServerComponentClient();
    const { data } = await sb
      .from("deals")
      .select("source, condition, damage_type, mileage, created_at, location_state")
      .eq("vin", vin)
      .limit(40);
    graph = sightingsToHistory(data || []);
  } catch {
    /* graph best-effort */
  }

  // Tier 2 — authoritative NMVTIS (only when a key is configured).
  const nmvtis = await fetchNmvtis(vin);

  if (!nmvtis && !graph)
    return NextResponse.json({ authoritative: false, source: "none" });

  // NMVTIS wins the "verified" badge; the graph flags are always folded in (dedup).
  const base = nmvtis || graph!;
  const merged: VinHistory = {
    ...base,
    titleBrands: Array.from(
      new Set([...(nmvtis?.titleBrands || []), ...(graph?.titleBrands || [])]),
    ),
    note: nmvtis && graph ? `${nmvtis.note} · ${graph.note}` : base.note,
  };
  return NextResponse.json(merged);
}
