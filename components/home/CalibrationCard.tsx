"use client";

import useSWR from "swr";

// The visible half of the learning loop — shows the user that HomeIQ is calibrating its score against what
// they ACTUALLY close. Honest by construction: it only reports resolved outcomes, shows real progress toward
// the point where the model starts adjusting, and says plainly when it's still learning. No fabricated
// "AI accuracy" number — just the realized win rate by the tier we predicted.

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "var(--home)";

const TIER_COLOR: Record<string, string> = {
  hot: "var(--red)",
  warm: "var(--amber)",
  standard: "var(--blue)",
  unknown: "var(--t4)",
};
const GATE = 50; // resolved deals before the model starts bending the score (matches readyToTrain)

export function CalibrationCard() {
  const { data } = useSWR("/api/homeiq/insights", fetcher, {
    revalidateOnFocus: false,
  });
  const s = data?.summary;
  if (!s || s.total === 0) return null; // nothing saved yet — the empty state covers it

  const active = !!data?.calibration;
  const pct = Math.min(100, Math.round((s.resolved / GATE) * 100));
  const tiers = Object.entries(
    s.winRateByTier as Record<string, { won: number; resolved: number }>,
  ).sort((a, b) => b[1].resolved - a[1].resolved);

  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-[var(--t4)]">
          🧠 Model calibration
        </h2>
        {active ? (
          <span
            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--green) 16%, transparent)",
              color: "var(--green)",
            }}
          >
            ✓ Live — adjusting scores
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-[var(--t4)]">
            {s.resolved}/{GATE} resolved to activate
          </span>
        )}
      </div>

      {/* Progress to the activation gate. */}
      {!active && (
        <div className="mb-3">
          <div className="h-2 rounded-full bg-[var(--s2)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(pct, 2)}%`, background: ACCENT }}
            />
          </div>
        </div>
      )}

      {/* Realized stats. */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Resolved" value={s.resolved} sub={`of ${s.total} saved`} />
        <Stat
          label="Win rate"
          value={s.winRate != null ? `${Math.round(s.winRate * 100)}%` : "—"}
          accent="var(--green)"
          sub="closed vs dead"
        />
        <Stat
          label="Avg profit"
          value={
            s.avgProfit != null
              ? `$${Math.round(s.avgProfit).toLocaleString()}`
              : "—"
          }
          accent={
            s.avgProfit != null && s.avgProfit < 0 ? "var(--red)" : ACCENT
          }
          sub="realized"
        />
      </div>

      {/* Win rate by the tier we PREDICTED — the actual calibration signal. */}
      {tiers.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--t5)]">
            Does our prediction hold up?
          </p>
          {tiers.map(([tier, t]) => {
            const rate = t.resolved ? t.won / t.resolved : 0;
            return (
              <div key={tier} className="flex items-center gap-2 text-[11px]">
                <span
                  className="w-14 shrink-0 font-bold capitalize"
                  style={{ color: TIER_COLOR[tier] || "var(--t3)" }}
                >
                  {tier}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--s2)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(rate * 100)}%`,
                      background: TIER_COLOR[tier] || "var(--t4)",
                    }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-[var(--t4)]">
                  {Math.round(rate * 100)}% · {t.won}/{t.resolved}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-[var(--t4)] leading-snug">
        {active ? (
          <>
            Scores are now nudged by how each tier actually converts in your
            pipeline — learned from {s.resolved} closed/dead deals.
          </>
        ) : (
          <>
            Mark deals <strong className="text-[var(--t3)]">Closed</strong>{" "}
            (won) or <strong className="text-[var(--t3)]">Dead</strong> (lost)
            as they resolve. At {GATE}, HomeIQ starts tuning the score toward
            what actually converts — no guesses, only your real outcomes.
          </>
        )}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = "var(--t1)",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[var(--r2)] border border-[var(--b1)] bg-[var(--s1)] px-3 py-2">
      <div className="text-lg font-black" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--t4)]">
        {label}
      </div>
      {sub && <div className="text-[9px] text-[var(--t5)] mt-0.5">{sub}</div>}
    </div>
  );
}
