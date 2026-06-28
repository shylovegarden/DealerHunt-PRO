export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getProperty } from "@/lib/housing/store";
import { scoreHousingLead } from "@/lib/housing/lead-score";
import { analyzeHousingDeal } from "@/lib/housing/deal-analyzer";
import type { Property } from "@/lib/housing/types";

// GET /api/homeiq/leads/[id] — one property's full HomeIQ analysis: lead score (with reasons), the
// 70%-rule deal analysis (ARV/repairs/MAO/verdict + notes), and location for the map.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await getProperty(id);
  if (!row) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const p = row as Property;
  // Prefer the stored score; recompute reasons + the deal analysis transparently.
  const score = scoreHousingLead(p);
  const analysis = analyzeHousingDeal(p);

  return NextResponse.json({
    lead: {
      id: row.source_listing_id,
      title: row.title,
      url: row.source_url,
      source: row.source,
      property_type: row.property_type,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      lat: row.lat,
      lng: row.lng,
      price: row.price,
      beds: row.beds,
      baths: row.baths,
      sqft: row.sqft,
      lot_size_acres: row.lot_size_acres,
      year_built: row.year_built,
      image: row.images?.[0],
      images: row.images || [],
      seller: row.seller,
      seller_type: row.seller_type,
      auction_end: row.auction_end,
      bid_count: row.bid_count,
      score: row.lead_score ?? score.score,
      tier: row.lead_tier ?? score.tier,
      signals: score.signals,
      analysis,
    },
  });
}
