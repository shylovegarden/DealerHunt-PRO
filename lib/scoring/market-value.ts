// lib/scoring/market-value.ts
// $0 market valuation built from our OWN multi-channel scraped data — the only free path,
// since every real vehicle-value API (MarketCheck/KBB/Edmunds/Black Book) is paid.
//
// We scrape both RETAIL channels (Cars.com, eBay, CarGurus, AutoTrader, Carvana…) and
// WHOLESALE/PRIVATE channels (Copart, IAA, Craigslist, Facebook…). The retail median is the
// resale target; the wholesale/private median is the acquisition benchmark. The gap between
// them is the real arbitrage signal — and it sharpens automatically as coverage grows.

import type { SupabaseClient } from "@supabase/supabase-js";

const RETAIL_SOURCES = new Set([
  "cars_com",
  "ebay_motors",
  "cargurus",
  "autotrader",
  "carvana",
  "truecar",
  "vroom",
  "carmax",
  "craigslist_dealer", // CL by-dealer section — real dealer asking prices ($0, unblocked)
]);
// Everything else (copart, iaa, manheim, adesa, acv, craigslist, facebook_marketplace,
// offerup, independent_dealer, gsa…) is treated as wholesale/private acquisition supply.

// Ask-to-sold haircut: listing asks run above actual transaction prices.
const ASK_TO_SOLD = 0.95;
// Minimum comps before we trust the figure.
const MIN_SAMPLES = 3;
const TTL_MS = 10 * 60 * 1000;

// Width of the year band used for grouping comps. A 3-year band keeps a 2021/2022/2023
// Silverado together while separating a 2008 from a 2024 (the "$2.5k→$25k" bug).
const YEAR_BAND = 3;
// Salvage/parts/rebuilt conditions that must NOT pollute the clean-retail resale bucket.
const SALVAGE_CONDITIONS = [
  "salvage",
  "parts",
  "rebuilt",
  "repairable",
  "flood",
  "junk",
  "non-runner",
  "wrecked",
];

export interface MarketComps {
  retail: number | null; // estimated resale value (ask-to-sold adjusted)
  wholesale: number | null; // typical acquisition price on auction/private channels
  nRetail: number;
  nWholesale: number;
  // Confidence in the retail figure, derived from sample count, so callers can tell
  // a thin (2-3 comp) estimate from a deep (50+ comp) one.
  confidence: "high" | "medium" | "low" | "none";
}

let computed: Map<string, MarketComps> | null = null;
let loadedAt = 0;

// Real demand proxy: how many active listings exist nationally for a make|model right now. Built
// from the same loaded deals (no extra query), keyed make|model across all years. Feeds the
// analyzer's demand/competition signal so scoring reflects ACTUAL supply scarcity instead of a
// hardcoded body-type guess. Few listings = scarce = moves faster; flooded = more competition.
let supplyByModel: Map<string, number> | null = null;

// The nightly `market_aggregates` rollup (pg_cron, avg of mmr_value per make/model/year/state/
// period) compounds every day. We fold it into a parallel index so a deal with thin live comps
// can still be valued from accumulated history — the "gets smarter as data grows" path. Kept
// SEPARATE from the retail comps map so retail semantics stay clean; consumed as a fallback tier.
let aggregates: Map<string, { value: number; n: number }> | null = null;

/** Normalize a model string so 'f-150', 'f150', 'F 150' all collapse to one token. */
function normalizeModel(model?: string | null): string {
  return (model || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "") // drop spaces/dashes: 'f-150' -> 'f150', 'grand cherokee' -> 'grandcherokee'
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Group a year into a fixed band so nearby model-years share comps. */
function yearBucket(year?: number | null): string {
  if (!year || year < 1900) return "na";
  return String(Math.floor(year / YEAR_BAND) * YEAR_BAND);
}

function key(
  make?: string | null,
  model?: string | null,
  year?: number | null,
): string {
  return `${(make || "").toLowerCase().trim()}|${normalizeModel(model)}|${yearBucket(year)}`;
}

function confidenceFor(n: number): MarketComps["confidence"] {
  if (n >= 12) return "high";
  if (n >= 6) return "medium";
  if (n >= MIN_SAMPLES) return "low";
  return "none";
}

function median(prices: number[]): number | null {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  if (sorted.length < 4) return sorted[Math.floor(sorted.length / 2)];

  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  // Aggressive outlier removal: 1.5× IQR (standard) but also enforce a max ratio
  // to prevent extreme outliers (e.g. Shelby GT500 at $42k in a $5k Mustang bucket).
  // Any price more than 3× the Q3 is rejected as an extreme outlier.
  const maxPrice = Math.max(q3 * 3, q3 + 1.5 * iqr);
  const minPrice = Math.max(0, q1 - 1.5 * iqr);

  const clean = sorted.filter((p) => p >= minPrice && p <= maxPrice);

  // Fall back to raw median if filtering removes too much
  const use = clean.length >= Math.ceil(sorted.length * 0.5) ? clean : sorted;
  return use[Math.floor(use.length / 2)];
}

/**
 * Load/refresh the in-memory market index from `deals`. Cached for TTL_MS so a full scrape
 * run only pays for it once. Call before scoring a batch.
 */
export async function loadMarketIndex(
  supabase: SupabaseClient,
  force = false,
): Promise<void> {
  if (computed && !force && Date.now() - loadedAt < TTL_MS) return;

  const { data, error } = await supabase
    .from("deals")
    .select(
      "make, model, year, mileage, source, ask_price, condition, damage_type",
    )
    .gt("ask_price", 1000)
    .lt("ask_price", 200000)
    .limit(50000);

  if (error) {
    console.warn("[market-value] index load failed:", error.message);
    if (!computed) computed = new Map();
    return;
  }

  const buckets = new Map<string, { retail: number[]; wholesale: number[] }>();
  const supply = new Map<string, number>();
  for (const r of data || []) {
    const k = key(r.make, r.model, r.year);
    // Require make + model present (year may be 'na'); skip empty rows.
    if (!(r.make && r.model)) continue;
    // Tally national supply per make|model (all years) for the demand-scarcity signal.
    const sk = `${(r.make || "").toLowerCase().trim()}|${normalizeModel(r.model)}`;
    supply.set(sk, (supply.get(sk) || 0) + 1);
    if (!buckets.has(k)) buckets.set(k, { retail: [], wholesale: [] });
    const b = buckets.get(k)!;
    if (RETAIL_SOURCES.has(r.source)) {
      // Clean-retail only: drop salvage/parts/rebuilt rows so resale comps aren't polluted.
      const cond = (r.condition || "").toLowerCase();
      const dmg = (r.damage_type || "").toLowerCase();
      const isSalvage =
        SALVAGE_CONDITIONS.some((s) => cond.includes(s)) ||
        (dmg !== "" && dmg !== "none");
      if (!isSalvage) b.retail.push(r.ask_price);
    } else {
      b.wholesale.push(r.ask_price);
    }
  }

  const next = new Map<string, MarketComps>();
  buckets.forEach((b, k) => {
    const retailMed = median(b.retail);
    next.set(k, {
      retail: retailMed != null ? Math.round(retailMed * ASK_TO_SOLD) : null,
      wholesale: median(b.wholesale),
      nRetail: b.retail.length,
      nWholesale: b.wholesale.length,
      confidence: confidenceFor(b.retail.length),
    });
  });
  computed = next;
  supplyByModel = supply;
  loadedAt = Date.now();
  console.log(
    `[market-value] index: ${next.size} make/model/year groups from ${(data || []).length} comps`,
  );

  // Fold in the nightly market_aggregates rollup (best-effort; never blocks scoring).
  await loadAggregateIndex(supabase);
}

/**
 * Build the aggregate-backed value index from `market_aggregates`. Rows are per
 * (year, make, model, state, source, period); we roll them up to the same make|model|yearBucket
 * key as the comps index, unit-count-weighting avg_market_value so high-sample quarters dominate.
 */
async function loadAggregateIndex(supabase: SupabaseClient): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("market_aggregates")
      .select("make, model, year, avg_market_value, unit_count")
      .gt("avg_market_value", 0)
      .limit(50000);

    if (error) {
      // Table may not exist on every environment — degrade silently to comps-only.
      if (!aggregates) aggregates = new Map();
      return;
    }

    const roll = new Map<string, { sum: number; n: number }>();
    for (const r of data || []) {
      if (!(r.make && r.model)) continue;
      const value = Number(r.avg_market_value);
      if (!Number.isFinite(value) || value <= 0) continue;
      const weight = Math.max(1, Number(r.unit_count) || 1);
      const k = key(r.make, r.model, r.year);
      const cur = roll.get(k) || { sum: 0, n: 0 };
      cur.sum += value * weight;
      cur.n += weight;
      roll.set(k, cur);
    }

    const next = new Map<string, { value: number; n: number }>();
    roll.forEach((v, k) =>
      next.set(k, { value: Math.round(v.sum / v.n), n: v.n }),
    );
    aggregates = next;
    if (next.size > 0)
      console.log(
        `[market-value] aggregate index: ${next.size} groups from market_aggregates`,
      );
  } catch {
    if (!aggregates) aggregates = new Map();
  }
}

/**
 * Aggregate-backed market value for a vehicle, from accumulated nightly history. Used as a
 * fallback tier when live retail comps are too thin to trust. Returns null when no history exists.
 */
export function lookupMarketAggregate(
  make?: string | null,
  model?: string | null,
  year?: number | null,
): { value: number; n: number } | null {
  if (!aggregates) return null;
  return aggregates.get(key(make, model, year)) || null;
}

/**
 * National active-listing count for a make|model from the loaded index — the real supply/demand
 * scarcity signal. Returns null when the index hasn't been loaded (caller falls back to its prior).
 */
export function lookupSupply(
  make?: string | null,
  model?: string | null,
): number | null {
  if (!supplyByModel) return null;
  const sk = `${(make || "").toLowerCase().trim()}|${normalizeModel(model)}`;
  return supplyByModel.get(sk) ?? 0;
}

/** Synchronous lookup from the loaded index. Returns null if not enough comparable data. */
export function lookupMarketValue(
  make?: string | null,
  model?: string | null,
  year?: number | null,
): MarketComps | null {
  if (!computed) return null;
  const c = computed.get(key(make, model, year));
  if (!c) return null;
  // Only return a retail figure we actually trust.
  if (c.retail != null && c.nRetail < MIN_SAMPLES) {
    return { ...c, retail: null, confidence: "none" };
  }
  return c;
}
