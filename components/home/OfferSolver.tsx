"use client";

import { useState } from "react";
import {
  REPAIR_PSF,
  REHAB_LABEL,
  MAO_RULE,
  flipVerdict,
  type RehabLevel,
  type HousingAnalysis,
} from "@/lib/housing/deal-analyzer";

// Interactive max-offer calculator — the housing twin of the cars MaxBidWidget. The repair number is an
// ASSUMPTION (sqft × an industry $/sqft); rather than hide that, we hand the user the dial. Move the rehab
// level or the target margin and the Max Allowable Offer, equity, and verdict recompute live — using the
// EXACT same pure helpers the server used (REPAIR_PSF / MAO_RULE / flipVerdict), so there's zero drift
// between "what we showed" and "what you can change". ARV is held fixed (it's comp-driven, not a guess).

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const VERDICT_COLOR: Record<string, string> = {
  strong: "var(--green)",
  fair: "var(--home)",
  tight: "var(--amber)",
  pass: "var(--red)",
  unknown: "var(--t4)",
};
const VERDICT_LABEL: Record<string, string> = {
  strong: "Strong buy",
  fair: "Fair deal",
  tight: "Tight",
  pass: "Pass",
  unknown: "—",
};

const LEVELS: RehabLevel[] = ["light", "medium", "heavy", "gut"];

export function OfferSolver({
  arv,
  sqft,
  askPrice,
  arvConfidence,
  defaultRehab,
}: {
  arv: number;
  sqft: number;
  askPrice: number;
  arvConfidence: HousingAnalysis["arvConfidence"];
  defaultRehab: RehabLevel;
}) {
  const [rehab, setRehab] = useState<RehabLevel>(defaultRehab);
  const [marginPct, setMarginPct] = useState(Math.round(MAO_RULE * 100)); // 70 by default

  const repairs = Math.round(sqft * REPAIR_PSF[rehab]);
  const margin = marginPct / 100;
  const mao = Math.round(arv * margin - repairs);
  const equity = Math.round(arv - askPrice - repairs);
  const verdict = flipVerdict(askPrice, arv, mao, equity, arvConfidence);
  const delta = mao - askPrice; // +ve = room under your max; -ve = ask is above your max

  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--t4)]">
          🧮 Offer calculator
        </h3>
        <span className="text-[10px] text-[var(--t4)]">live · your inputs</span>
      </div>

      {/* Rehab level — the repair assumption, now yours to set. */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-[var(--t3)]">
            Rehab level
          </span>
          <span className="text-[11px] font-mono text-[var(--t4)]">
            ${REPAIR_PSF[rehab]}/sqft · {money(repairs)}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {LEVELS.map((lv) => {
            const active = lv === rehab;
            return (
              <button
                key={lv}
                onClick={() => setRehab(lv)}
                className="px-1 py-1.5 rounded-[var(--r2)] text-[11px] font-bold capitalize transition-colors border"
                style={
                  active
                    ? {
                        background: "var(--home)",
                        borderColor: "var(--home)",
                        color: "#04201d",
                      }
                    : {
                        background: "var(--s2)",
                        borderColor: "var(--b1)",
                        color: "var(--t3)",
                      }
                }
                title={REHAB_LABEL[lv]}
              >
                {lv}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-[var(--t5)]">
          {REHAB_LABEL[rehab]}
        </p>
      </div>

      {/* Target margin — the 70% rule is the default, but flippers run tighter/looser. */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-[var(--t3)]">
            Target margin (ARV ×)
          </span>
          <span className="text-[11px] font-mono text-[var(--t4)]">
            {marginPct}%{marginPct === 70 ? " · 70% rule" : ""}
          </span>
        </div>
        <input
          type="range"
          min={60}
          max={80}
          step={1}
          value={marginPct}
          onChange={(e) => setMarginPct(Number(e.target.value))}
          className="w-full accent-[var(--home)]"
          aria-label="Target margin percent"
        />
      </div>

      {/* Result — the number that moves. */}
      <div className="grid grid-cols-3 gap-3 pt-1 border-t border-[var(--b1)]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--t4)]">
            Max offer
          </div>
          <div
            className="text-xl font-black"
            style={{ color: VERDICT_COLOR[verdict] }}
          >
            {money(Math.max(0, mao))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--t4)]">
            Gross equity
          </div>
          <div
            className="text-xl font-black"
            style={{ color: equity >= 0 ? "var(--green)" : "var(--red)" }}
          >
            {equity >= 0 ? money(equity) : `−${money(-equity)}`}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--t4)]">
            Verdict
          </div>
          <div
            className="text-xl font-black capitalize"
            style={{ color: VERDICT_COLOR[verdict] }}
          >
            {VERDICT_LABEL[verdict]}
          </div>
        </div>
      </div>

      {/* Plain-English position vs the asking price. */}
      <p className="text-[11px] text-[var(--t3)] leading-snug">
        {delta >= 0 ? (
          <>
            Asking {money(askPrice)} is{" "}
            <span className="font-black text-[var(--green)]">
              {money(delta)} under
            </span>{" "}
            your max — room to offer and still hit your margin.
          </>
        ) : (
          <>
            Asking {money(askPrice)} is{" "}
            <span className="font-black text-[var(--red)]">
              {money(-delta)} over
            </span>{" "}
            your max offer — you'd need a discount to make the numbers work.
          </>
        )}
        {arvConfidence === "low" && (
          <span className="text-[var(--amber)]">
            {" "}
            ARV here is an estimate — confirm with local comps before acting.
          </span>
        )}
      </p>
    </div>
  );
}
