"use client";

import type { HousingAnalysis } from "@/lib/housing/deal-analyzer";

// "How we got this number" — the honesty backbone made visible. Every dollar figure on a listing traces
// back to either REAL data (our own fresh sold comps, or a committed Redfin median) or a clearly-labeled
// ASSUMPTION (the rehab $/sqft rule-of-thumb). This panel shows the user exactly which, with the comp count
// when we have it, so the big ARV number is never mistaken for something it isn't. Pure presentational.

const money = (n?: number | null) =>
  n != null ? `$${Math.round(n).toLocaleString()}` : "—";

// The ARV source ladder, most-trustworthy first. Each tier names what it is in plain English + a color.
function arvTier(a: HousingAnalysis): {
  label: string;
  detail: string;
  color: string;
  real: boolean;
} {
  // Live = our own freshly-harvested sold comps for this ZIP — the thing that makes pricing "learn".
  if (a.arvSource === "live")
    return {
      label: a.arvComps ? `Live sold comps · ${a.arvComps}` : "Live sold comps",
      detail: a.arvComps
        ? `Median of ${a.arvComps} real closed sales we harvested in this ZIP`
        : "Median of real closed sales we harvested in this ZIP",
      color: "var(--green)",
      real: true,
    };
  if (a.arvSource === "provided")
    return {
      label: "Verified comps",
      detail: "Real comparable sales provided for this property",
      color: "var(--green)",
      real: true,
    };
  if (a.arvSource === "snapshot") {
    if (a.arvConfidence === "high")
      return {
        label: "ZIP sold-comp median",
        detail: "Redfin Data Center median sale $/sqft for this exact ZIP",
        color: "var(--green)",
        real: true,
      };
    if (a.arvConfidence === "medium")
      return {
        label: "County median",
        detail:
          "Redfin county median sale $/sqft — comp-grade, confirm locally",
        color: "var(--home)",
        real: true,
      };
    return {
      label: "Statewide median — coarse",
      detail:
        "Only a statewide median sale $/sqft is available — too broad to trust as a flip; verify with local comps",
      color: "var(--amber)",
      real: true,
    };
  }
  if (a.arvSource === "regional")
    return {
      label: "Regional estimate — no comps yet",
      detail:
        "No sold comps for this area yet — a coarse regional $/sqft reference. An estimate, not a comp.",
      color: "var(--amber)",
      real: false,
    };
  return {
    label: "No ARV",
    detail: "Needs square footage or comps before a value can be computed",
    color: "var(--t4)",
    real: false,
  };
}

function ConfidencePill({
  level,
}: {
  level: HousingAnalysis["arvConfidence"];
}) {
  const map: Record<string, { label: string; color: string }> = {
    high: { label: "High confidence", color: "var(--green)" },
    medium: { label: "Medium confidence", color: "var(--home)" },
    low: { label: "Low — estimate", color: "var(--amber)" },
    none: { label: "Not computable", color: "var(--t4)" },
  };
  const m = map[level] || map.none;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{
        background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
        color: m.color,
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: m.color }}
      />
      {m.label}
    </span>
  );
}

export function ValuationBasis({
  analysis,
  sqft,
}: {
  analysis: HousingAnalysis;
  sqft?: number | null;
}) {
  const a = analysis;
  if (a.arv == null && a.repairEstimate == null) return null;
  const tier = arvTier(a);

  return (
    <div className="space-y-3">
      {/* ARV provenance */}
      {a.arv != null && (
        <div className="rounded-[var(--r2)] border border-[var(--b1)] bg-[var(--s0)] p-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--t4)]">
              After-repair value
            </span>
            <ConfidencePill level={a.arvConfidence} />
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-black text-[var(--t1)]">
              {money(a.arv)}
            </span>
            {a.arvPsf != null && sqft != null && (
              <span className="text-[11px] text-[var(--t4)] font-mono">
                {sqft.toLocaleString()} sqft × ${a.arvPsf}/sqft
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: `color-mix(in srgb, ${tier.color} 13%, transparent)`,
                color: tier.color,
              }}
            >
              {tier.real ? "✓" : "≈"} {tier.label}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--t4)] leading-snug">
            {tier.detail}
          </p>
        </div>
      )}

      {/* Repair assumption — explicitly an estimate, never harvested. */}
      {a.repairEstimate != null && a.repairEstimate > 0 && (
        <div className="rounded-[var(--r2)] border border-[var(--b1)] bg-[var(--s0)] p-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--t4)]">
              Repairs
            </span>
            <span
              className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: "color-mix(in srgb, var(--amber) 14%, transparent)",
                color: "var(--amber)",
              }}
            >
              Assumption
            </span>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-black text-[var(--t1)]">
              {money(a.repairEstimate)}
            </span>
            {a.repairPsf != null && sqft != null && (
              <span className="text-[11px] text-[var(--t4)] font-mono">
                {sqft.toLocaleString()} sqft × ${a.repairPsf}/sqft ·{" "}
                {a.rehabLevel}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--t4)] leading-snug">
            Industry rule-of-thumb by rehab level — not harvested. Tune it in
            the offer calculator below to match what you actually see.
          </p>
        </div>
      )}
    </div>
  );
}
