export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { harvestGovDealsProperties } from "@/lib/housing/sources/govdeals-property";
import { scoreHousingLead } from "@/lib/housing/lead-score";
import { analyzeHousingDeal } from "@/lib/housing/deal-analyzer";
import { rentCashflow } from "@/lib/housing/rent";
import { loadLivePsf } from "@/lib/housing/live-psf";
import { loadCalibration } from "@/lib/housing/calibration";
import { flagPriceAnomalies } from "@/lib/housing/anomaly";
import { neighborhoodScore } from "@/lib/housing/neighborhood";
import {
  queryProperties,
  countByState,
  upsertProperties,
  type StoredProperty,
} from "@/lib/housing/store";
import { STATE_COORDS } from "@/lib/geo";
import { housingPriceTerms } from "@/lib/housing/price-semantics";
import { normalizeAddress } from "@/lib/housing/address-normalize";
import { leadCategories } from "@/lib/housing/categories";
import type { Property } from "@/lib/housing/types";

// Distress lists that count toward a "stack" (flip/high-equity are deal-quality, not distress lists).
const STACK_CATS = new Set([
  "tax_delinquent",
  "preforeclosure",
  "vacant",
  "absentee",
  "out_of_state",
  "code_violation",
  "reo",
  "land_bank",
]);

// Cross-source list-stacking: group leads by normalized address, count distinct distress lists per
// property, and stamp each lead's `stack`. A property on tax-delinquent + vacant + absentee = stack 3.
function applyStacking(all: Lead[]): void {
  const byAddr = new Map<string, Set<string>>();
  for (const l of all) {
    const key = normalizeAddress(l.address, l.city, l.state, l.zip);
    if (!key) continue;
    let set = byAddr.get(key);
    if (!set) byAddr.set(key, (set = new Set()));
    for (const c of leadCategories(l)) if (STACK_CATS.has(c)) set.add(c);
  }
  for (const l of all) {
    const key = normalizeAddress(l.address, l.city, l.state, l.zip);
    l.stack = key ? byAddr.get(key)?.size || 0 : 0;
  }
}

// GET /api/homeiq/leads?state=IL&tier=hot — scored real-estate leads, hottest-first, with map points.
// DB-FIRST: reads the `properties` table (instant). If the store is empty/unavailable, it live-harvests
// GovDeals, scores, persists for next time, and serves the fresh result. Resilient end-to-end.

// A normalized lead the dashboard consumes, from either the DB or a live harvest.
interface Lead {
  id: string;
  title: string;
  url?: string;
  price?: number;
  source?: string;
  status?: string; // listing status for land-bank stock (Move-In Ready / Needs Renovation / Vacant Land…)
  property_type?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  image?: string;
  // Public-record owner of record + mailing address (direct-mail ready when a county feed supplies it).
  owner?: string;
  ownerMailing?: string;
  // Cross-source list-stacking: # of distinct distress lists this property sits on (1 = single list).
  stack?: number;
  // Compact distress detail (amount owed, years, sheriff sale, below-market…) for card/detail badges.
  distress?: Record<string, unknown>;
  beds?: number;
  baths?: number;
  sqft?: number;
  year_built?: number;
  // Glance metrics (from signals where the source carries them — Redfin/MLS).
  daysOnMarket?: number;
  pricePerSqft?: number;
  mlsNumber?: string;
  brokerage?: string;
  // Price-drop tracking (our own harvest-over-harvest detection).
  priceDrops?: number | null;
  prevPrice?: number | null;
  priceChangedAt?: string | null;
  // Statistical underpricing flag (vs same-state/type $/sqft peers).
  anomaly?: boolean;
  anomalyPct?: number;
  // Census ACS neighborhood trajectory ("rising" | "stable" | "declining"), when the ZIP is in the snapshot.
  neighborhood?: string;
  auction_end?: string;
  bid_count?: number;
  lat?: number;
  lng?: number;
  score: number;
  tier: string;
  signals: string[];
  // Flip math (70% rule) — present only when ARV is computable (sqft known).
  mao?: number | null;
  arv?: number | null;
  verdict?: string;
  equity?: number | null;
  // Buy-and-hold math (rent → cap rate) — present only when the ZIP has rent data.
  capRate?: number | null;
  cashflowMo?: number | null;
  cashflowRating?: string;
}

// Distill the raw `signals` blob into a compact, UI-renderable distress object. The connectors harvest
// PropStream-grade detail (amount owed, years, sheriff sale, bankruptcy, out-of-state owner, market value,
// violation counts) but the list previously flattened it to reason-strings — this surfaces the magnitudes.
function distressFrom(p: Property): Record<string, unknown> | undefined {
  const s = (p.signals as any) || {};
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
}

// Per-listing glance metrics carried in `signals` by the source (Redfin/MLS) — surfaced on the card.
function glanceFrom(p: Property): Partial<Lead> {
  const s = (p.signals as any) || {};
  const ppsf =
    s.price_per_sqft ??
    (p.sqft && p.price ? Math.round(p.price / p.sqft) : undefined);
  return {
    year_built: p.year_built ?? undefined,
    daysOnMarket:
      typeof s.days_on_market === "number" ? s.days_on_market : undefined,
    pricePerSqft: ppsf ? Math.round(Number(ppsf)) : undefined,
    mlsNumber: s.mls_number ? String(s.mls_number) : undefined,
    brokerage: s.brokerage ? String(s.brokerage) : undefined,
  };
}

// Attach the two money lenses to a lead: the 70%-rule FLIP math and the rental HOLD math (cap rate /
// cashflow on the all-in basis = ask + estimated repairs). Each lights up only when its inputs exist.
function withAnalysis<T extends Lead>(lead: T, p: Property): T {
  const a = analyzeHousingDeal(p);
  if (a.mao != null) {
    lead.mao = a.mao;
    lead.arv = a.arv;
    lead.verdict = a.verdict;
    lead.equity = a.equitySpread;
  }
  const cf = rentCashflow(p.price, p.zip, {
    basis:
      p.price && a.repairEstimate != null
        ? p.price + a.repairEstimate
        : undefined,
  });
  if (cf) {
    lead.capRate = cf.capRatePct;
    lead.cashflowMo = cf.monthlyCashflow;
    lead.cashflowRating = cf.rating;
  }
  return lead;
}

// In-memory fallback cache for the live-harvest path (when the DB isn't populated yet).
let LIVE: { at: number; leads: Lead[] } | null = null;
const TTL_MS = 10 * 60_000;

function jitter(seed: string, salt: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h + salt * 7919) % 1000) / 1000 - 0.5) * 0.9;
}

// Land-bank stock carries a short human status (Move-In Ready / Vacant Land / List Only…) in
// signals.status or signals.sale_type. Never use `description` — for some sources (Detroit) it's a long
// marketing blurb, not a status — unless it's short enough to be a label (Genesee's "Res Vac Lot · …").
function landBankStatus(p: Property): string | undefined {
  if (p.source !== "land_bank") return undefined;
  const sig = p.signals as any;
  const candidates = [sig?.status, sig?.sale_type, p.description];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() && c.trim().length <= 40)
      return c.trim();
  }
  return undefined;
}

function fromStored(r: StoredProperty): Lead {
  // Re-score LIVE on read so the latest intelligence (county-anchored ARV + the profit money-gate) is
  // reflected immediately and the tier stays consistent with the verdict — rather than serving the
  // stored score frozen at last harvest. The Docker PC's re-score keeps the stored copy fresh for sort.
  const ls = scoreHousingLead(r as Property);
  return withAnalysis(
    {
      id: r.source_listing_id || r.title,
      title: r.title,
      url: r.source_url,
      price: r.price,
      source: r.source,
      status: landBankStatus(r),
      property_type: r.property_type,
      address: r.address,
      distress: distressFrom(r),
      owner: (r.signals as any)?.owner,
      ownerMailing: (r.signals as any)?.owner_mailing,
      city: r.city,
      state: r.state,
      zip: r.zip,
      image: r.images?.[0],
      beds: r.beds,
      baths: r.baths,
      sqft: r.sqft,
      ...glanceFrom(r),
      auction_end: r.auction_end,
      bid_count: r.bid_count,
      lat: r.lat,
      lng: r.lng,
      priceDrops: r.price_drops,
      prevPrice: r.prev_price,
      priceChangedAt: r.price_changed_at,
      neighborhood: neighborhoodScore(r.zip)?.trajectory,
      score: ls.score,
      tier: ls.tier,
      signals: ls.signals,
    },
    r,
  );
}

function fromLive(p: Property): Lead {
  const lead = scoreHousingLead(p);
  return withAnalysis(
    {
      id: p.source_listing_id || p.title,
      title: p.title,
      url: p.source_url,
      price: p.price,
      source: p.source,
      status: landBankStatus(p),
      property_type: p.property_type,
      address: p.address,
      distress: distressFrom(p),
      owner: (p.signals as any)?.owner,
      ownerMailing: (p.signals as any)?.owner_mailing,
      city: p.city,
      state: p.state,
      zip: p.zip,
      image: p.images?.[0],
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      ...glanceFrom(p),
      auction_end: p.auction_end,
      bid_count: p.bid_count,
      lat: p.lat,
      lng: p.lng,
      score: lead.score,
      tier: lead.tier,
      signals: lead.signals,
    },
    p,
  );
}

async function liveHarvest(): Promise<Lead[]> {
  if (LIVE && Date.now() - LIVE.at < TTL_MS) return LIVE.leads;
  const properties = await harvestGovDealsProperties("GD", 3);
  // Persist for next time (best-effort; -1 = no table yet, just serve live).
  upsertProperties(properties).catch(() => {});
  const leads = properties.map(fromLive).sort((a, b) => b.score - a.score);
  LIVE = { at: Date.now(), leads };
  return leads;
}

// Full-market per-state counts, cached (5 min) — drives an accurate scope selector regardless of which
// scoped slice we return, without re-scanning 54k rows every request.
let STATE_COUNTS: { at: number; data: Record<string, number> } | null = null;
async function cachedCountByState(): Promise<Record<string, number>> {
  if (STATE_COUNTS && Date.now() - STATE_COUNTS.at < 5 * 60_000)
    return STATE_COUNTS.data;
  const data = await countByState().catch(() => ({}));
  STATE_COUNTS = { at: Date.now(), data };
  return data;
}

export async function GET(req: NextRequest) {
  // Inject the freshest comps (live sold $/sqft) AND the learned tier calibration BEFORE any (re)scoring,
  // so every served lead's score matches the harvest + detail paths deterministically (fromStored
  // recomputes the score, so without this the list could use a stale TIER_CAL left on a warm worker).
  await loadLivePsf().catch(() => {});
  await loadCalibration().catch(() => {});
  const sp = new URL(req.url).searchParams;
  const state = (sp.get("state") || "").toUpperCase();
  const statesParam = (sp.get("states") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  // Scope = explicit states list (nearby) > single state > null (national top-N).
  const scopeStates = statesParam.length ? statesParam : state ? [state] : null;
  const tier = sp.get("tier") || "";
  const source = sp.get("source") || "";

  let all: Lead[];
  try {
    // SERVER-SIDE SCOPE: a state / nearby view is queried from the FULL table (its own top-3000), not a
    // slice of the global top-2000 — so all 54k are reachable by location. National = global top-2000.
    const stored = await queryProperties(
      scopeStates ? { states: scopeStates, limit: 3000 } : { limit: 2000 },
    );
    all =
      stored && stored.length
        ? stored.map(fromStored)
        : scopeStates
          ? [] // empty scope = no leads there yet (don't fall back to the cars-ish live harvest)
          : await liveHarvest();
    all.sort((a, b) => b.score - a.score);
    applyStacking(all); // cross-source list-stacking → each lead's `stack` count
    // Statistical underpricing flag ("🎯 priced N% below comps") — robust MAD test vs same state+type
    // $/sqft peers, independent of the distress scorer. Display + filter only (score already rewards equity).
    const anomalies = flagPriceAnomalies(all);
    for (const l of all) {
      const a = anomalies.get(l.id);
      if (a) {
        l.anomaly = true;
        l.anomalyPct = a.pctBelow;
        l.signals = [
          ...(l.signals || []),
          `🎯 Priced ${a.pctBelow}% below comps`,
        ];
      }
    }
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, leads: [], points: [] },
      { status: 502 },
    );
  }

  // Accurate full-market state counts for the selector; tier/source tallies from the in-scope slice.
  const byState = await cachedCountByState();
  const byTier = { hot: 0, warm: 0, standard: 0 } as Record<string, number>;
  const bySource: Record<string, number> = {};
  for (const l of all) {
    byTier[l.tier] = (byTier[l.tier] || 0) + 1;
    if (l.source) bySource[l.source] = (bySource[l.source] || 0) + 1;
  }

  // Already scoped server-side; tier/source remain optional server filters for direct API callers.
  let filtered = all;
  if (tier) filtered = filtered.filter((l) => l.tier === tier);
  if (source) filtered = filtered.filter((l) => l.source === source);

  const points = filtered
    .map((l) => {
      let lat = l.lat;
      let lng = l.lng;
      if (lat == null || lng == null) {
        const c = STATE_COORDS[(l.state || "").toUpperCase()];
        if (!c) return null;
        lat = c.lat + jitter(l.id, 1);
        lng = c.lon + jitter(l.id, 2);
      }
      return {
        id: l.id,
        name: l.title,
        lat,
        lng,
        type:
          l.tier === "hot" ? "hub" : l.tier === "warm" ? "auction" : "dealer",
        label: `$${(l.price || 0).toLocaleString()} · score ${l.score} · ${l.city || ""} ${l.state || ""}`,
        // Rich fields for the Zillow-style map (price-pill marker + photo-card popup).
        price: l.price,
        priceLabel: housingPriceTerms(l.source, !!l.auction_end).priceLabel,
        score: l.score,
        tier: l.tier,
        image: l.image,
        beds: l.beds,
        baths: l.baths,
        sqft: l.sqft,
        verdict: l.verdict ?? undefined,
        stack: l.stack,
        url: `/homeiq/leads/${encodeURIComponent(l.id)}`,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    count: filtered.length,
    total: all.length,
    byTier,
    byState,
    bySource,
    leads: filtered,
    points,
  });
}
