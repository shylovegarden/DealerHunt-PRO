export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchNmvtis } from "@/lib/vehicle/vin-history";

// GET /api/vin/{vin}/history — authoritative NMVTIS history (Tier 2). Returns the report when a
// VINAUDIT_KEY is configured, else { authoritative:false } so the client falls back to the free
// listing-text tier it already computed. No key = no cost, no failure.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ vin: string }> },
) {
  const { vin } = await ctx.params;
  const report = await fetchNmvtis(vin);
  if (!report)
    return NextResponse.json({ authoritative: false, source: "none" });
  return NextResponse.json(report);
}
