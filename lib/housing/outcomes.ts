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
