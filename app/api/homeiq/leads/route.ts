export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { harvestGovDealsProperties } from "@/lib/housing/sources/govdeals-property";
import { scoreHousingLead } from "@/lib/housing/lead-score";
import { analyzeHousingDeal } from "@/lib/housing/deal-analyzer";
import {
  queryProperties,
  upsertProperties,
  type StoredProperty,
} from "@/lib/housing/store";
import { STATE_COORDS } from "@/lib/geo";
import type { Property } from "@/lib/housing/types";

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
  city?: string;
  state?: string;
  zip?: string;
  image?: string;
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
}

// Attach the 70%-rule flip math to a lead, from its property fields.
function withAnalysis<T extends Lead>(lead: T, p: Property): T {
  const a = analyzeHousingDeal(p);
  if (a.mao != null) {
    lead.mao = a.mao;
    lead.arv = a.arv;
    lead.verdict = a.verdict;
    lead.equity = a.equitySpread;
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
      city: r.city,
      state: r.state,
      zip: r.zip,
      image: r.images?.[0],
      auction_end: r.auction_end,
      bid_count: r.bid_count,
      lat: r.lat,
      lng: r.lng,
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
      city: p.city,
      state: p.state,
      zip: p.zip,
      image: p.images?.[0],
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

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const state = (sp.get("state") || "").toUpperCase();
  const tier = sp.get("tier") || "";
  const source = sp.get("source") || "";
  const limit = Math.min(
    2000,
    Math.max(1, parseInt(sp.get("limit") || "2000", 10) || 2000),
  );

  let all: Lead[];
  try {
    // Pull the whole market (cap 2000) so the dashboard can scope/filter client-side and every
    // source — including lower-scored land-bank lots — is reachable, not buried under a 500 cap.
    const stored = await queryProperties({ limit: 2000 });
    all =
      stored && stored.length ? stored.map(fromStored) : await liveHarvest();
    // Order by the LIVE score (re-scored on read) so hottest-first matches the live tiers.
    all.sort((a, b) => b.score - a.score);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, leads: [], points: [] },
      { status: 502 },
    );
  }

  const byTier = { hot: 0, warm: 0, standard: 0 } as Record<string, number>;
  const byState: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const l of all) {
    byTier[l.tier] = (byTier[l.tier] || 0) + 1;
    if (l.state) byState[l.state] = (byState[l.state] || 0) + 1;
    if (l.source) bySource[l.source] = (bySource[l.source] || 0) + 1;
  }

  let filtered = all;
  if (state)
    filtered = filtered.filter((l) => (l.state || "").toUpperCase() === state);
  if (tier) filtered = filtered.filter((l) => l.tier === tier);
  if (source) filtered = filtered.filter((l) => l.source === source);
  filtered = filtered.slice(0, limit);

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
