// lib/housing/outcomes.ts
//
// The learning loop's data contract. Each saved lead carries a feature snapshot (lead_score/tier, mao,
// arv, verdict, source, price) captured at save-time, a pipeline status (closed = won, dead = lost), and —
// once recorded — a realized outcome (actualProfit) inside snapshot.outcome. This turns those into clean
// TRAINING ROWS so a future calibration model can learn which leads actually convert/profit (the BatchRank
// / iSpeedToLead approach), instead of the hand-tuned heuristic. Pure — no I/O — so it's trivially tested
// and reused by both an offline trainer and an on-app insights view.

export interface SavedLead {
  status?: string;
  snapshot?: Record<string, any> | null;
}

export interface OutcomeRow {
  // Features (as captured at save time).
  leadScore: number | null;
  leadTier: string | null;
  verdict: string | null;
  source: string | null;
  price: number | null;
  arv: number | null;
  mao: number | null;
  // Label.
  won: boolean; // reached "closed"
  lost: boolean; // marked "dead"
  resolved: boolean; // won || lost
  actualProfit: number | null;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Turn a saved lead into a training row (features + label). Returns null if there's no usable snapshot. */
export function extractOutcomeRow(lead: SavedLead): OutcomeRow | null {
  const snap = lead.snapshot;
  if (!snap || typeof snap !== "object") return null;
  const status = (lead.status || "").toLowerCase();
  const won = status === "closed";
  const lost = status === "dead";
  return {
    leadScore: num(snap.lead_score),
    leadTier: snap.lead_tier ?? null,
    verdict: snap.verdict ?? null,
    source: snap.source ?? null,
    price: num(snap.price),
    arv: num(snap.arv),
    mao: num(snap.mao),
    won,
    lost,
    resolved: won || lost,
    actualProfit: num(snap.outcome?.actualProfit),
  };
}

export interface OutcomeSummary {
  total: number;
  resolved: number;
  won: number;
  lost: number;
  winRate: number | null; // won / resolved
  avgProfit: number | null; // over rows with a recorded actualProfit
  /** Win rate by the lead tier we predicted — the calibration signal ("is hot actually hot?"). */
  winRateByTier: Record<string, { won: number; resolved: number }>;
  /** True once there's enough resolved data to train a calibration model. */
  readyToTrain: boolean;
}

// How much real resolved data each tier needs before its win rate is trusted to nudge scoring (below this
// the sample is noise). Exported so the UI can honestly gray out a tier the model is still ignoring.
export const MIN_TIER_RESOLVED = 8;
// The learned nudge is clamped to ±15% so a small, noisy sample can never dominate the hand-tuned base.
const CAL_MIN = 0.85;
const CAL_MAX = 1.15;

export interface TierCalibration {
  /** Per-tier score multiplier learned from realized win rates (1 = no change). */
  byTier: Record<string, number>;
  /** How many resolved outcomes this calibration is based on — surfaced to the user for honesty. */
  basis: number;
}

/**
 * Turn realized outcomes into a per-tier score multiplier — the actual LEARNING step. For each predicted
 * tier we compare its real win rate to the overall win rate: a tier that wins MORE often than average gets
 * nudged up, one that wins less gets nudged down, clamped to ±15%. Returns null until there's enough real
 * data (readyToTrain) — so with no/insufficient outcomes the score is unchanged. NEVER invents a signal: a
 * tier without ≥MIN_TIER_RESOLVED real resolutions keeps a factor of exactly 1.
 */
export function calibrationFromOutcomes(
  summary: OutcomeSummary,
): TierCalibration | null {
  if (!summary.readyToTrain || !summary.winRate || summary.resolved === 0)
    return null;
  const overall = summary.winRate;
  if (overall <= 0) return null;
  const byTier: Record<string, number> = {};
  for (const [tier, s] of Object.entries(summary.winRateByTier)) {
    if (s.resolved < MIN_TIER_RESOLVED) {
      byTier[tier] = 1;
      continue;
    }
    const tierRate = s.won / s.resolved;
    byTier[tier] = Math.max(CAL_MIN, Math.min(CAL_MAX, tierRate / overall));
  }
  return { byTier, basis: summary.resolved };
}

/** Aggregate training rows into a calibration view (and a gate for when a model becomes worth training). */
export function summarizeOutcomes(rows: OutcomeRow[]): OutcomeSummary {
  const resolvedRows = rows.filter((r) => r.resolved);
  const won = resolvedRows.filter((r) => r.won).length;
  const profits = rows
    .map((r) => r.actualProfit)
    .filter((p): p is number => p != null);
  const byTier: Record<string, { won: number; resolved: number }> = {};
  for (const r of resolvedRows) {
    const t = r.leadTier || "unknown";
    (byTier[t] ??= { won: 0, resolved: 0 }).resolved++;
    if (r.won) byTier[t].won++;
  }
  return {
    total: rows.length,
    resolved: resolvedRows.length,
    won,
    lost: resolvedRows.length - won,
    winRate: resolvedRows.length ? won / resolvedRows.length : null,
    avgProfit: profits.length
      ? Math.round(profits.reduce((a, b) => a + b, 0) / profits.length)
      : null,
    winRateByTier: byTier,
    readyToTrain: resolvedRows.length >= 50, // enough labels to beat the heuristic
  };
}
