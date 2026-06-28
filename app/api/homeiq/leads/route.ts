export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { harvestGovDealsProperties } from "@/lib/housing/sources/govdeals-property";
import { scoreAndRank } from "@/lib/housing/lead-score";
import { STATE_COORDS } from "@/lib/geo";
import type { Property } from "@/lib/housing/types";
import type { LeadScore } from "@/lib/housing/lead-score";

// GET /api/homeiq/leads?state=IL&tier=hot — real GovDeals real-estate leads, scored hottest-first, with
// map points. Harvesting the public API takes several seconds, so results are cached in-memory for 10
// min (the listings barely move); the dashboard loads instantly after the first hit.

type Scored = Property & { lead: LeadScore };
let CACHE: { at: number; leads: Scored[] } | null = null;
const TTL_MS = 10 * 60_000;

// Stable per-id offset so properties without precise coords spread around their state centroid.
function jitter(seed: string, salt: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h + salt * 7919) % 1000) / 1000 - 0.5) * 0.9;
}

async function getLeads(): Promise<Scored[]> {
  if (CACHE && Date.now() - CACHE.at < TTL_MS) return CACHE.leads;
  const properties = await harvestGovDealsProperties("GD", 3);
  const leads = scoreAndRank(properties);
  CACHE = { at: Date.now(), leads };
  return leads;
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const state = (sp.get("state") || "").toUpperCase();
  const tier = sp.get("tier") || "";
  const limit = Math.min(
    500,
    Math.max(1, parseInt(sp.get("limit") || "200", 10) || 200),
  );

  let leads: Scored[];
  try {
    leads = await getLeads();
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, leads: [], points: [] },
      { status: 502 },
    );
  }

  let filtered = leads;
  if (state)
    filtered = filtered.filter((l) => (l.state || "").toUpperCase() === state);
  if (tier) filtered = filtered.filter((l) => l.lead.tier === tier);
  filtered = filtered.slice(0, limit);

  const points = filtered
    .map((l) => {
      const id = l.source_listing_id || l.title;
      let lat = l.lat;
      let lng = l.lng;
      if (lat == null || lng == null) {
        const c = STATE_COORDS[(l.state || "").toUpperCase()];
        if (!c) return null;
        lat = c.lat + jitter(id, 1);
        lng = c.lon + jitter(id, 2);
      }
      return {
        id,
        name: l.title,
        lat,
        lng,
        type:
          l.lead.tier === "hot"
            ? "hub"
            : l.lead.tier === "warm"
              ? "auction"
              : "dealer",
        label: `$${(l.price || 0).toLocaleString()} · score ${l.lead.score} · ${l.city || ""} ${l.state || ""}`,
      };
    })
    .filter(Boolean);

  const byTier = { hot: 0, warm: 0, standard: 0 } as Record<string, number>;
  for (const l of leads) byTier[l.lead.tier]++;
  const byState: Record<string, number> = {};
  for (const l of leads)
    if (l.state) byState[l.state] = (byState[l.state] || 0) + 1;

  return NextResponse.json({
    count: filtered.length,
    total: leads.length,
    byTier,
    byState,
    leads: filtered.map((l) => ({
      id: l.source_listing_id,
      title: l.title,
      url: l.source_url,
      price: l.price,
      property_type: l.property_type,
      city: l.city,
      state: l.state,
      zip: l.zip,
      image: l.images?.[0],
      auction_end: l.auction_end,
      bid_count: l.bid_count,
      score: l.lead.score,
      tier: l.lead.tier,
      signals: l.lead.signals,
    })),
    points,
  });
}
