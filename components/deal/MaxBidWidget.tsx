"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Mono } from "@/components/shared/Mono";
import { Ico } from "@/components/shared/Ico";
import { computeMaxBid, type MaxBidCosts } from "@/lib/scoring/max-bid";

export interface MaxBidCalibration {
  sellMultiplier: number;
  transportMultiplier: number;
  reconMultiplier: number;
  sampleSize: number;
}

interface MaxBidWidgetProps {
  sellEstimate?: number | null;
  source?: string | null;
  askPrice?: number | null;
  costs?: MaxBidCosts | null;
  // Smart default for the slider — the dealer's saved target profit (Settings). Falls back to 3000.
  defaultTargetProfit?: number | null;
  // The dealer's learned calibration (from their logged outcomes). When present, the resale and
  // cost inputs are bent to THEIR actual history before solving for the max bid.
  calibration?: MaxBidCalibration | null;
}

const fmt = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(val));

export function MaxBidWidget({
  sellEstimate,
  source,
  askPrice,
  costs,
  defaultTargetProfit,
  calibration,
}: MaxBidWidgetProps) {
  // Bend the resale + cost inputs to the dealer's own logged history when we have a calibration.
  const cal = calibration && calibration.sampleSize >= 5 ? calibration : null;
  const sell = cal
    ? Math.round((Number(sellEstimate) || 0) * cal.sellMultiplier)
    : Number(sellEstimate) || 0;
  const calibratedCosts: MaxBidCosts | null | undefined =
    cal && costs
      ? {
          ...costs,
          transport: (Number(costs.transport) || 0) * cal.transportMultiplier,
          repair: (Number(costs.repair) || 0) * cal.reconMultiplier,
        }
      : costs;
  // Default the slider to the dealer's saved target profit, clamped to the slider range.
  const initialTarget = React.useMemo(() => {
    const saved = Number(defaultTargetProfit) || 0;
    const max = Math.max(1000, Math.round(sell * 0.6));
    if (saved <= 0) return 3000;
    return Math.min(Math.max(500, saved), max);
  }, [defaultTargetProfit, sell]);
  const [targetProfit, setTargetProfit] = React.useState(initialTarget);

  // Re-seed when the resale estimate or saved default resolves (async profile fetch).
  React.useEffect(() => {
    setTargetProfit(initialTarget);
  }, [initialTarget]);

  const result = React.useMemo(() => {
    const { maxBid, marginPct } = computeMaxBid({
      sellEstimate: sell,
      targetProfit,
      costs: calibratedCosts,
      source,
    });
    return { maxBid, impliedRoi: marginPct };
  }, [sell, targetProfit, calibratedCosts, source]);

  const ask = Number(askPrice) || 0;
  const headroom = ask > 0 ? result.maxBid - ask : null; // positive = ask below max (good)
  const hasSell = sell > 0;

  return (
    <Card
      className="border-none overflow-hidden"
      style={{ background: "var(--s0)", boxShadow: "var(--shadow)" }}
    >
      <div className="h-1 w-full" style={{ background: "var(--grad)" }} />
      <CardContent className="p-6 md:p-7">
        <div className="flex items-center gap-2 mb-1">
          <Ico name="calculator" size={15} className="text-[var(--t4)]" />
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--t4)] font-bold">
            Name your price
          </p>
          {cal && (
            <span
              className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "var(--amber-lo)", color: "var(--amber-d)" }}
              title={`Resale ×${cal.sellMultiplier}, transport ×${cal.transportMultiplier}, recon ×${cal.reconMultiplier} from your logged deals`}
            >
              Calibrated · {cal.sampleSize} deals
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--t3)] mb-5">
          Set the profit you want. We&apos;ll tell you the most you can bid and
          still hit it.
        </p>

        {!hasSell ? (
          <p className="text-sm text-[var(--t4)]">
            No resale estimate yet — max bid unavailable.
          </p>
        ) : (
          <>
            {/* Target profit control */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] uppercase tracking-widest text-[var(--t4)] font-bold">
                  Target profit
                </label>
                <Mono
                  className="text-lg font-black text-[var(--t1)]"
                  style={{ fontFamily: "var(--fm)" }}
                >
                  {fmt(targetProfit)}
                </Mono>
              </div>
              <input
                type="range"
                min={500}
                max={Math.max(1000, Math.round(sell * 0.6))}
                step={100}
                value={targetProfit}
                onChange={(e) => setTargetProfit(Number(e.target.value))}
                className="w-full accent-[var(--amber)] cursor-pointer"
                style={{ accentColor: "var(--amber)" }}
                aria-label="Target profit"
              />
              <div className="flex justify-between text-[10px] text-[var(--t5)] mt-1 font-semibold">
                <span>{fmt(500)}</span>
                <span>{fmt(Math.max(1000, Math.round(sell * 0.6)))}</span>
              </div>
            </div>

            {/* Max bid readout */}
            <div
              className="rounded-[var(--r3)] p-5"
              style={{ background: "var(--s1)" }}
            >
              <p className="text-[10px] uppercase tracking-widest text-[var(--t4)] font-bold mb-1">
                Your max bid
              </p>
              <Mono
                className="text-4xl md:text-5xl font-black text-[var(--t1)] leading-none"
                style={{ fontFamily: "var(--fm)" }}
              >
                {fmt(result.maxBid)}
              </Mono>
              <p className="text-xs text-[var(--t3)] font-semibold mt-2">
                to net {fmt(targetProfit)} profit · {result.impliedRoi}% ROI
              </p>
            </div>

            {/* Comparison to ask */}
            {headroom != null && (
              <div className="mt-4">
                {headroom >= 0 ? (
                  <div
                    className="flex items-center gap-2 text-sm font-bold px-3.5 py-2.5 rounded-[var(--r2)]"
                    style={{ background: "var(--glo)", color: "var(--green)" }}
                  >
                    <Ico name="check-circle" size={16} />
                    {fmt(headroom)} of headroom — ask ({fmt(ask)}) is below your
                    max bid
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 text-sm font-bold px-3.5 py-2.5 rounded-[var(--r2)]"
                    style={{ background: "var(--rlo)", color: "var(--red)" }}
                  >
                    <Ico name="alert-triangle" size={16} />
                    Ask is {fmt(Math.abs(headroom))} ABOVE your max bid
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
