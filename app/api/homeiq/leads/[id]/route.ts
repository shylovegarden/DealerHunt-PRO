export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getProperty } from "@/lib/housing/store";
import { scoreHousingLead } from "@/lib/housing/lead-score";
import { analyzeHousingDeal } from "@/lib/housing/deal-analyzer";
import { rentCashflow } from "@/lib/housing/rent";
import { holdingCost } from "@/lib/housing/holding-cost";
import { loadLivePsf } from "@/lib/housing/live-psf";
import { loadCalibration } from "@/lib/housing/calibration";
import type { Property } from "@/lib/housing/types";

// GET /api/homeiq/leads/[id] — one property's full HomeIQ analysis: lead score (with reasons), the
// 70%-rule deal analysis (ARV/repairs/MAO/verdict + notes), and location for the map.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Inject live sold $/sqft (freshest ARV comps) + the learned tier calibration (realized pipeline
  // outcomes) so this lead's score reflects everything we've learned. Both are no-ops until data exists.
  const temp = await loadLivePsf().catch(() => null);
  await loadCalibration().catch(() => null);
  const row = await getProperty(id);
  if (!row) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const p = row as Property;
  const market = (p.zip && temp?.get(String(p.zip).slice(0, 5))) || undefined;
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
  // The time cost of the flip — taxes + insurance + utilities + hard-money interest over the hold. Months
  // ≈ 3 (rehab) + the ZIP's median days-on-market ÷ 30 (list→close) when we know it.
  const holding =
    p.price && p.price > 0
      ? holdingCost({
          price: p.price,
          repairEstimate: analysis.repairEstimate,
          annualTaxes: Number((p.signals as any)?.annual_taxes) || null,
          months: market?.medianDom
            ? Math.round(3 + market.medianDom / 30)
            : undefined,
        })
      : null;

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
          : (row.signals as any)?.status, // MLS/HUD/REO status (Active/Pending/Pre-Market…) was dropped
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
      // Listing identity (MLS-grade) + glance metrics — collected by Redfin/MLS/REO sources, never shown.
      listing: (() => {
        const s = (row.signals as any) || {};
        const ppsf =
          s.price_per_sqft ??
          (row.sqft && row.price
            ? Math.round(row.price / row.sqft)
            : undefined);
        const l: Record<string, unknown> = {};
        if (s.mls_number) l.mls = String(s.mls_number);
        if (s.brokerage) l.brokerage = String(s.brokerage);
        if (s.agent) l.agent = String(s.agent);
        if (typeof s.days_on_market === "number")
          l.daysOnMarket = s.days_on_market;
        if (ppsf) l.pricePerSqft = Math.round(Number(ppsf));
        // REO occupancy (HUD/Fannie) — materially affects whether/when you can bid.
        if (s.occupancy) l.occupancy = String(s.occupancy);
        if (s.tenant_occupied) l.tenantOccupied = true;
        if (s.first_look) l.firstLook = true;
        if (s.reo) l.reo = true;
        return Object.keys(l).length ? l : undefined;
      })(),
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
      priceDrops: row.price_drops,
      prevPrice: row.prev_price,
      priceChangedAt: row.price_changed_at,
      // Use the FRESH recompute for score+tier+signals together (calibration + live comps already injected
      // above) so they're one consistent unit — and so the "Calibrated from N deals" reason can never sit
      // next to a stored score that predates it. Matches the list route, which also recomputes.
      score: score.score,
      tier: score.tier,
      signals: score.signals,
      analysis,
      cashflow,
      holding, // time cost of the flip: { perMonth, months, total, breakdown, notes }
      market, // live ZIP temperature: { activeCount, medianDom, listPsf } — context, not ARV
    },
  });
}
