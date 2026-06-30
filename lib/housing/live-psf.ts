// lib/housing/live-psf.ts
//
// LIVE pricing that learns from our own harvest. Two halves, both keyed by ZIP, stored in `zip_live_psf`:
//   • SOLD $/sqft (psf_*) — the ARV input. Aggregated from harvestRedfinSold (real recent closed comps),
//     fresher than the committed Redfin Data Center snapshot. Injected into arv-psf as the top tier.
//   • MARKET TEMPERATURE (active_*) — active count, median days-on-market, median ASKING $/sqft. For users
//     as context; NEVER used as ARV (asking ≠ sold). Computed from the active listings the regular harvest
//     already pulls, so it costs no extra fetch.
//
// loadLivePsf() reads the table → injects the sold map into arv-psf (setLiveZipPsf) + returns the temp map,
// cached so a request doesn't re-read. The pricing job (worker, 6h) refreshes the sold half; the regular
// 30-min harvest refreshes the temperature half. Best-effort + isolated (missing table = no-op).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "./types";
import { setLiveZipPsf } from "./arv-psf";
import { harvestRedfinSold } from "./sources/redfin-gis";

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
}

const median = (xs: number[]): number | undefined => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const psfOf = (p: Property): number | undefined => {
  const direct = Number((p.signals as any)?.price_per_sqft);
  if (Number.isFinite(direct) && direct > 0) return direct;
  if (p.price && p.sqft && p.sqft > 0) return p.price / p.sqft;
  return undefined;
};

const COL: Record<string, string> = {
  single_family: "psf_single_family",
  multi_family: "psf_multi_family",
  condo: "psf_condo",
};

/** Aggregate SOLD comps into per-ZIP median $/sqft rows (all + by type). Requires ≥4 comps for a ZIP. */
export function aggregateSoldPsf(sold: Property[]): Record<string, unknown>[] {
  const byZip = new Map<
    string,
    { all: number[]; byType: Record<string, number[]> }
  >();
  for (const p of sold) {
    const zip = (p.zip || "").slice(0, 5);
    const v = psfOf(p);
    if (!/^\d{5}$/.test(zip) || v == null || v < 5 || v > 5000) continue;
    let g = byZip.get(zip);
    if (!g) byZip.set(zip, (g = { all: [], byType: {} }));
    g.all.push(v);
    const t = p.property_type;
    if (t && COL[t]) (g.byType[t] ??= []).push(v);
  }
  const rows: Record<string, unknown>[] = [];
  for (const [zip, g] of Array.from(byZip.entries())) {
    if (g.all.length < 4) continue;
    const row: Record<string, unknown> = {
      zip,
      psf_all: Math.round(median(g.all)!),
      sold_comps: g.all.length,
      updated_at: new Date().toISOString(),
    };
    for (const [t, col] of Object.entries(COL)) {
      const vs = g.byType[t];
      if (vs && vs.length >= 3) row[col] = Math.round(median(vs)!);
    }
    rows.push(row);
  }
  return rows;
}

/** Aggregate ACTIVE listings into per-ZIP market temperature (count, median DOM, median asking $/sqft). */
export function aggregateMarketTemp(
  props: Property[],
): Record<string, unknown>[] {
  const byZip = new Map<string, { dom: number[]; psf: number[]; n: number }>();
  for (const p of props) {
    if (p.source !== "redfin" && p.source !== "mls") continue;
    const zip = (p.zip || "").slice(0, 5);
    if (!/^\d{5}$/.test(zip)) continue;
    let g = byZip.get(zip);
    if (!g) byZip.set(zip, (g = { dom: [], psf: [], n: 0 }));
    g.n++;
    const dom = Number((p.signals as any)?.days_on_market);
    if (Number.isFinite(dom) && dom >= 0) g.dom.push(dom);
    const v = psfOf(p);
    if (v != null && v > 5 && v < 5000) g.psf.push(v);
  }
  const rows: Record<string, unknown>[] = [];
  for (const [zip, g] of Array.from(byZip.entries())) {
    if (g.n < 3) continue;
    rows.push({
      zip,
      active_count: g.n,
      median_dom: g.dom.length ? Math.round(median(g.dom)!) : null,
      list_psf: g.psf.length ? Math.round(median(g.psf)!) : null,
      updated_at: new Date().toISOString(),
    });
  }
  return rows;
}

async function upsert(rows: Record<string, unknown>[]): Promise<number> {
  if (!rows.length) return 0;
  const sb = service();
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb
      .from("zip_live_psf")
      .upsert(rows.slice(i, i + 500), { onConflict: "zip" });
    if (error) {
      console.warn("[live-psf] upsert skipped:", error.message);
      return n;
    }
    n += Math.min(500, rows.length - i);
  }
  return n;
}

/** Refresh the SOLD half — harvest recent closed comps + write per-ZIP medians. Called by the 6h pricing job. */
export async function refreshSoldPsf(): Promise<number> {
  try {
    const sold = await harvestRedfinSold();
    const rows = aggregateSoldPsf(sold);
    const n = await upsert(rows);
    console.log(`[live-psf] sold comps → ${n} ZIP medians`);
    return n;
  } catch (e) {
    console.warn("[live-psf] refreshSoldPsf skipped:", (e as Error).message);
    return 0;
  }
}

/** Refresh the TEMPERATURE half from the active listings a harvest already pulled. Called each harvest. */
export async function refreshMarketTemp(active: Property[]): Promise<number> {
  try {
    return await upsert(aggregateMarketTemp(active));
  } catch (e) {
    console.warn("[live-psf] refreshMarketTemp skipped:", (e as Error).message);
    return 0;
  }
}

// ── Read side ───────────────────────────────────────────────────────────────
export interface MarketTemp {
  activeCount?: number;
  medianDom?: number;
  listPsf?: number;
}
let CACHE: { at: number; temp: Map<string, MarketTemp> } | null = null;
const TTL = 15 * 60_000;

/**
 * Load the live table → inject the SOLD $/sqft map into arv-psf (so ARV uses it) and return the market-temp
 * map (for display). Cached. Safe to call at the top of every request and at harvest start.
 */
export async function loadLivePsf(): Promise<Map<string, MarketTemp>> {
  if (CACHE && Date.now() - CACHE.at < TTL) return CACHE.temp;
  const temp = new Map<string, MarketTemp>();
  const byZip: Record<string, Record<string, number>> = {};
  const comps: Record<string, number> = {};
  try {
    const sb = service();
    const { data, error } = await sb
      .from("zip_live_psf")
      .select(
        "zip, psf_all, psf_single_family, psf_multi_family, psf_condo, sold_comps, active_count, median_dom, list_psf",
      );
    if (!error && data) {
      for (const r of data as any[]) {
        if (r.psf_all) {
          const m: Record<string, number> = { all: r.psf_all };
          if (r.psf_single_family) m.single_family = r.psf_single_family;
          if (r.psf_multi_family) m.multi_family = r.psf_multi_family;
          if (r.psf_condo) m.condo = r.psf_condo;
          byZip[r.zip] = m;
          if (r.sold_comps) comps[r.zip] = Number(r.sold_comps);
        }
        temp.set(r.zip, {
          activeCount: r.active_count ?? undefined,
          medianDom: r.median_dom ?? undefined,
          listPsf: r.list_psf ?? undefined,
        });
      }
    }
  } catch (e) {
    console.warn("[live-psf] load skipped:", (e as Error).message);
  }
  setLiveZipPsf(byZip, comps);
  CACHE = { at: Date.now(), temp };
  return temp;
}
