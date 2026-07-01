// lib/housing/anomaly.ts
//
// Statistical underpricing detector — the "🎯 priced 34% below the market" flag, independent of the
// keyword/distress scorer. Within a peer group (same state + property type), we compare each listing's
// $/sqft to the group's MEDIAN using a robust MAD outlier test, so a genuinely mispriced home surfaces
// even with zero distress language. Robust (median/MAD, not mean/stdev) so a few mansions or $1 land-bank
// shells can't distort the baseline. Pure + tested. Only flags where there are enough real peers — never
// invents an anomaly from a thin sample.

export interface AnomalyLead {
  id: string;
  state?: string;
  property_type?: string;
  price?: number;
  sqft?: number | null;
  pricePerSqft?: number | null;
}

export interface AnomalyFlag {
  /** % below the peer-group median $/sqft. */
  pctBelow: number;
}

const MIN_PEERS = 8; // fewer than this = too thin to call an outlier
const MIN_PCT_BELOW = 30; // must be at least this far under the median to flag
const MAD_K = 3; // and a robust outlier (below median − K·MAD)

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const ppsfOf = (l: AnomalyLead): number | null => {
  if (l.pricePerSqft && l.pricePerSqft > 0) return l.pricePerSqft;
  if (l.price && l.sqft && l.sqft > 0) return l.price / l.sqft;
  return null;
};

/**
 * Flag statistically-underpriced listings. Returns a map of lead id → { pctBelow } for the anomalies only
 * (non-anomalies are absent). Groups by state|property_type; needs ≥MIN_PEERS priced-per-sqft peers, and a
 * lead must be both ≥MIN_PCT_BELOW% under the median AND a MAD outlier to qualify.
 */
export function flagPriceAnomalies(
  leads: AnomalyLead[],
): Map<string, AnomalyFlag> {
  const groups = new Map<string, { id: string; ppsf: number }[]>();
  for (const l of leads) {
    const ppsf = ppsfOf(l);
    if (ppsf == null || ppsf < 5 || ppsf > 5000) continue; // guard junk
    const key = `${(l.state || "").toUpperCase()}|${l.property_type || "any"}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push({
      id: l.id,
      ppsf,
    });
  }

  const out = new Map<string, AnomalyFlag>();
  for (const rows of Array.from(groups.values())) {
    if (rows.length < MIN_PEERS) continue;
    const vals = rows.map((r) => r.ppsf);
    const med = median(vals);
    if (med <= 0) continue;
    const mad = median(vals.map((v) => Math.abs(v - med))) || med * 0.15;
    const floor = med - MAD_K * mad;
    for (const r of rows) {
      const pctBelow = Math.round((1 - r.ppsf / med) * 100);
      if (pctBelow >= MIN_PCT_BELOW && r.ppsf < floor) {
        out.set(r.id, { pctBelow });
      }
    }
  }
  return out;
}
