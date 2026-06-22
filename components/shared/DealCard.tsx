"use client";

import React, { memo } from "react";
import { Mono } from "./Mono";
import { cn } from "@/lib/utils";
import type { Deal } from "@/lib/data/deals-service";
import { liteDealIQ, IQ_TIER_COLOR } from "@/lib/intelligence/lite-iq";

export interface DealCardProps {
  id: string;
  source: string;
  year: number;
  make: string;
  model: string;
  askPrice: number;
  mmrValue: number;
  profitEstimate: number;
  profitScore?: number;
  locationCity?: string;
  locationState?: string;
  mileage?: number;
  condition?: string;
  damageType?: string;
  /** Engine verdict — surfaced as a colored pill */
  dealVerdict?: "go" | "hold" | "pass";
  /** Recommended max bid (secondary line under net profit) */
  recommendedMaxBid?: number;
  /** Estimated resale value */
  sellEstimate?: number;
  onClick?: () => void;
}

const VERDICT_STYLES: Record<
  string,
  { label: string; text: string; bg: string }
> = {
  go: { label: "GO", text: "var(--green)", bg: "var(--glo)" },
  hold: { label: "HOLD", text: "var(--amber)", bg: "var(--amber-lo)" },
  pass: { label: "PASS", text: "var(--t4)", bg: "var(--s2)" },
};

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  copart: { bg: "var(--blo)", text: "var(--blue)" },
  iaa: { bg: "var(--plo)", text: "var(--purple)" },
  craigslist: { bg: "var(--olo)", text: "var(--orange)" },
  facebook: { bg: "var(--blo)", text: "var(--blue)" },
  ebay: { bg: "var(--amber-lo)", text: "var(--amber)" },
  manheim: { bg: "var(--glo)", text: "var(--green)" },
  adesa: { bg: "var(--glo)", text: "var(--green)" },
  acv: { bg: "var(--glo)", text: "var(--green)" },
};

function getSourceColor(source: string) {
  const key = source.toLowerCase().split(/[^a-z]/)[0];
  return SOURCE_COLORS[key] ?? { bg: "var(--s2)", text: "var(--t4)" };
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: "var(--green)", bg: "var(--glo)" };
  if (score >= 60) return { text: "var(--amber)", bg: "var(--amber-lo)" };
  return { text: "var(--red)", bg: "var(--rlo)" };
}

function formatCondition(condition?: string, damageType?: string): string {
  if (damageType && condition) return `${damageType} / ${condition}`;
  if (damageType) return damageType;
  if (condition) return condition;
  return "Unknown";
}

export const DealCard = memo(function DealCard({
  id,
  source,
  year,
  make,
  model,
  askPrice,
  mmrValue,
  profitEstimate,
  profitScore = 50,
  locationCity,
  locationState,
  mileage,
  condition,
  damageType,
  dealVerdict,
  recommendedMaxBid,
  sellEstimate,
  onClick,
}: DealCardProps) {
  const srcColor = getSourceColor(source);
  const scoreColor = getScoreColor(profitScore);
  const isPositive = profitEstimate >= 0;
  const location = [locationCity, locationState].filter(Boolean).join(", ");
  const verdict = dealVerdict ? VERDICT_STYLES[dealVerdict] : null;
  // Zero-cost Deal IQ from fields already on the card.
  const iq = liteDealIQ({ askPrice, sellEstimate, mmrValue, profitEstimate });

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
      className={cn(
        "glass-panel flex flex-col overflow-hidden group select-none",
        onClick &&
          "cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--amber)] focus-visible:outline-none",
      )}
      style={{
        willChange: "transform",
        transition:
          "transform 170ms cubic-bezier(.16,1,.3,1), box-shadow 170ms cubic-bezier(.16,1,.3,1)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
    >
      {/* Top strip: source badge + score ring */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: "var(--b1)", background: "var(--s1)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-[var(--r1)] shrink-0"
            style={{ background: srcColor.bg, color: srcColor.text }}
          >
            {source.toUpperCase()}
          </span>
          {verdict && (
            <span
              className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-[var(--r1)] shrink-0"
              style={{ background: verdict.bg, color: verdict.text }}
              title="Engine verdict"
            >
              {verdict.label}
            </span>
          )}
          {iq && (
            <span
              className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-[var(--r1)] shrink-0"
              style={{ background: "var(--s2)", color: IQ_TIER_COLOR[iq.tier] }}
              title={`Deal IQ ${iq.score}/100 (${iq.tier})`}
            >
              IQ {iq.score}
            </span>
          )}
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{
            background: scoreColor.bg,
            color: scoreColor.text,
            fontFamily: "var(--fm)",
          }}
          title={`Profit Score: ${profitScore}/100`}
        >
          {profitScore}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Title */}
        <h3
          className="font-bold text-[var(--t1)] text-base leading-tight"
          style={{ transition: "color 170ms cubic-bezier(.16,1,.3,1)" }}
        >
          <span className="group-hover:text-[var(--amber)] transition-colors">
            {year} {make} {model}
          </span>
        </h3>

        {/* Location + mileage */}
        <div className="flex items-center gap-2 text-xs text-[var(--t3)] flex-wrap">
          {location && (
            <span className="flex items-center gap-1">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 21C12 21 5 13.5 5 9a7 7 0 0 1 14 0c0 4.5-7 12-7 12z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {location}
            </span>
          )}
          {location && mileage ? <span className="opacity-30">·</span> : null}
          {mileage ? (
            <Mono className="text-[var(--t2)] text-[11px]">
              {mileage.toLocaleString()} mi
            </Mono>
          ) : null}
        </div>

        {/* Price grid */}
        <div
          className="rounded-[var(--r2)] grid grid-cols-2 gap-3 px-3 py-2.5"
          style={{ background: "var(--s1)" }}
        >
          <div>
            <p className="text-[9px] uppercase tracking-widest text-[var(--t4)] font-semibold mb-0.5">
              Ask Price
            </p>
            <Mono className="text-sm font-extrabold text-[var(--t1)]">
              ${askPrice.toLocaleString()}
            </Mono>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-[var(--t4)] font-semibold mb-0.5">
              MMR Value
            </p>
            <Mono className="text-sm font-extrabold text-[var(--t3)]">
              {mmrValue ? `$${mmrValue.toLocaleString()}` : "N/A"}
            </Mono>
          </div>
        </div>

        {/* Big profit */}
        <div className="flex items-end justify-between mt-auto pt-1 gap-2">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-[var(--t4)] font-semibold mb-0.5">
              Net Profit Est.
            </p>
            <Mono
              className="text-2xl font-black leading-none"
              style={{ color: isPositive ? "var(--green)" : "var(--red)" }}
            >
              {isPositive ? "+" : "-"}$
              {Math.abs(profitEstimate).toLocaleString()}
            </Mono>
            {recommendedMaxBid != null && (
              <p className="text-[10px] text-[var(--t4)] font-medium mt-1">
                Max bid{" "}
                <Mono className="text-[var(--t2)] font-bold">
                  ${recommendedMaxBid.toLocaleString()}
                </Mono>
              </p>
            )}
          </div>

          {(condition || damageType) && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-[var(--r1)] max-w-[120px] text-right leading-tight shrink-0"
              style={{
                background: damageType ? "var(--rlo)" : "var(--glo)",
                color: damageType ? "var(--red)" : "var(--green)",
              }}
            >
              {formatCondition(condition, damageType)}
            </span>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div
        className="px-4 py-3 border-t flex items-center justify-between gap-3"
        style={{ borderColor: "var(--b1)", background: "var(--s1)" }}
      >
        <span className="text-[11px] text-[var(--t4)] font-medium font-mono truncate">
          #{id.slice(0, 8).toUpperCase()}
        </span>
        <a
          href={`/deal/${id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs font-bold text-white rounded-[var(--r2)] px-3 py-1.5 shrink-0 border-none"
          style={{
            background: "var(--grad)",
            transition: "transform 120ms cubic-bezier(.16,1,.3,1)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "";
          }}
        >
          View Deal
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
});

// Shimmer skeleton for loading grid
export function DealCardSkeleton() {
  return (
    <div
      className="glass-panel flex flex-col overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: "var(--b1)", background: "var(--s1)" }}
      >
        <div className="h-5 w-16 rounded-[var(--r1)] shimmer" />
        <div className="w-9 h-9 rounded-full shimmer" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="h-5 w-3/4 rounded-[var(--r2)] shimmer" />
        <div className="h-3 w-1/2 rounded-[var(--r1)] shimmer" />
        <div className="h-14 w-full rounded-[var(--r2)] shimmer" />
        <div className="h-7 w-1/2 rounded-[var(--r2)] shimmer mt-1" />
      </div>
      <div
        className="px-4 py-3 border-t flex items-center justify-between"
        style={{ borderColor: "var(--b1)", background: "var(--s1)" }}
      >
        <div className="h-3 w-16 rounded-[var(--r1)] shimmer" />
        <div className="h-7 w-20 rounded-[var(--r2)] shimmer" />
      </div>
    </div>
  );
}
