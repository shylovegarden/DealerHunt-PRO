// Pure aggregation helpers for the HomeIQ Market Intelligence dashboard. Kept separate from the React
// page so the math (price bucketing, medians, facet counts) is unit-testable and reusable. No I/O.

export interface MarketLead {
  price?: number;
  source?: string;
  property_type?: string;
  state?: string;
  tier: string;
  equity?: number | null;
  verdict?: string;
}

export interface PriceBin {
  from: number;
  to: number;
  n: number;
}

/** Median of a numeric list (0 for empty). Does not mutate the input. */
export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Build `nBuckets` price buckets up to the 95th percentile (so a handful of mansions don't flatten the
// chart), with the final bucket catching everything at/above the cap. Returns [] when there's too little
// data to bucket meaningfully. Bucket width is rounded up to a clean $5k step.
export function priceBins(
  prices: number[],
  nBuckets = 12,
  step = 5000,
): PriceBin[] {
  const sorted = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (sorted.length < 4) return [];
  const p95 =
    sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  const rawWidth = Math.max(p95 / nBuckets, 1000);
  const width = Math.ceil(rawWidth / step) * step;
  const bins: PriceBin[] = Array.from({ length: nBuckets }, (_, i) => ({
    from: i * width,
    to: (i + 1) * width,
    n: 0,
  }));
  for (const v of sorted) {
    const idx = Math.min(Math.floor(v / width), nBuckets - 1);
    bins[idx].n++;
  }
  return bins;
}

// Count leads by a string field, skipping null/empty values.
export function countBy(
  leads: MarketLead[],
  key: keyof MarketLead,
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const l of leads) {
    const v = l[key] as string | undefined;
    if (v) m[v] = (m[v] || 0) + 1;
  }
  return m;
}

export interface MarketSummary {
  priced: number[];
  bins: PriceBin[];
  bySource: Record<string, number>;
  byType: Record<string, number>;
  byState: Record<string, number>;
  byStateHot: Record<string, number>;
  byTier: Record<string, number>;
  byVerdict: Record<string, number>;
  flippable: number;
  medianPrice: number;
}

// One pass over the market into every facet the dashboard renders. Pure — given the same leads it always
// returns the same summary, so it can be memoized in the page and asserted in tests.
export function summarizeMarket(leads: MarketLead[]): MarketSummary {
  const priced = leads.map((l) => l.price ?? 0).filter((p) => p > 0);

  const byTier: Record<string, number> = { hot: 0, warm: 0, standard: 0 };
  const byStateHot: Record<string, number> = {};
  const byVerdict: Record<string, number> = {};
  let flippable = 0;
  for (const l of leads) {
    byTier[l.tier] = (byTier[l.tier] || 0) + 1;
    if (l.tier === "hot" && l.state)
      byStateHot[l.state] = (byStateHot[l.state] || 0) + 1;
    if (l.verdict && l.verdict !== "unknown")
      byVerdict[l.verdict] = (byVerdict[l.verdict] || 0) + 1;
    if (typeof l.equity === "number" && l.equity > 0) flippable++;
  }

  return {
    priced,
    bins: priceBins(priced),
    bySource: countBy(leads, "source"),
    byType: countBy(leads, "property_type"),
    byState: countBy(leads, "state"),
    byStateHot,
    byTier,
    byVerdict,
    flippable,
    medianPrice: median(priced),
  };
}
