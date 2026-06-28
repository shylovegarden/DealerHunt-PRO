export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { propertyStats } from "@/lib/housing/store";

// GET /api/homeiq/market — nationwide rollup for the full-country view: total + per-state + per-tier
// counts across the whole `properties` table. Cached briefly (the table moves slowly).

let CACHE: { at: number; data: any } | null = null;
const TTL = 5 * 60_000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.at < TTL)
    return NextResponse.json(CACHE.data);
  const stats = await propertyStats();
  const data = stats || { total: 0, byTier: {}, byState: {} };
  CACHE = { at: Date.now(), data };
  return NextResponse.json(data);
}
