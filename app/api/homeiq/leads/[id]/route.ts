export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getProperty } from "@/lib/housing/store";
import { scoreHousingLead } from "@/lib/housing/lead-score";
import { analyzeHousingDeal } from "@/lib/housing/deal-analyzer";
import { rentCashflow } from "@/lib/housing/rent";
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
  // Buy-and-hold view (rent → cap rate / cashflow), on the all-in basis (ask + estimated repairs).
  const cashflow = rentCashflow(p.price, p.zip, {
    basis:
      p.price && analysis.repairEstimate != null
        ? p.price + analysis.repairEstimate
        : undefined,
  });

  return NextResponse.json({
    lead: {
      id: row.source_listing_id,
      title: row.title,
      url: row.source_url,
      source: row.source,
      status:
        row.source === "land_bank"
          ? [
              (row.signals as any)?.status,
              (row.signals as any)?.sale_type,
              row.description,
            ].find(
              (c) => typeof c === "string" && c.trim() && c.trim().length <= 40,
            )
          : undefined,
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
      // Public-record owner contact (county assessor / tax roll) → enables direct mail. Phone/email is
      // NOT scraped — that needs a licensed, compliant skip-trace provider (surfaced as an opt-in).
      owner: (row.signals as any)?.owner,
      ownerMailing: (row.signals as any)?.owner_mailing,
      distress: (() => {
        const s = (row.signals as any) || {};
        const d: Record<string, unknown> = {};
        if (s.total_due) d.totalDue = Math.round(Number(s.total_due));
        if (s.years_owed) d.yearsOwed = Number(s.years_owed);
        if (s.sheriff_sale) d.sheriffSale = true;
        if (s.foreclosure) d.foreclosure = true;
        if (s.bankruptcy) d.bankruptcy = true;
        if (s.out_of_state_owner) d.outOfState = true;
        if (s.owner_state) d.ownerState = String(s.owner_state);
        if (s.market_value) d.marketValue = Math.round(Number(s.market_value));
        if (s.below_market) d.belowMarket = true;
        if (s.violation_count) d.violations = Number(s.violation_count);
        if (s.vacant) d.vacant = true;
        if (s.reo) d.reo = true;
        return Object.keys(d).length ? d : undefined;
      })(),
      auction_end: row.auction_end,
      bid_count: row.bid_count,
      score: row.lead_score ?? score.score,
      tier: row.lead_tier ?? score.tier,
      signals: score.signals,
      analysis,
      cashflow,
    },
  });
}
