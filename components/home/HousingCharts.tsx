"use client";

import React from "react";
import { Mono } from "@/components/shared/Mono";

// Lightweight, dependency-free chart primitives for the HomeIQ market dashboard. Pure SVG/CSS so we add
// zero packages (the project ships no charting lib) and match the cars-side custom visualizers. Styled in
// the HomeIQ language: glass panels, teal accent, --t*/--b*/--s* tokens.

export const ACCENT = "#2dd4bf";

export function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--t4)]">
          {title}
        </h3>
        {hint && <span className="text-[10px] text-[var(--t5)]">{hint}</span>}
      </div>
      <div className="flex-1 min-h-[140px]">{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="h-full grid place-items-center text-xs text-[var(--t5)]">
      Not enough data
    </div>
  );
}

const fmtK = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
    : n >= 1000
      ? `$${Math.round(n / 1000)}k`
      : `$${n}`;

// Vertical histogram with per-bar hover tooltips. Bins: { from, to, n }.
export function Histogram({
  bins,
  color = "var(--amber)",
}: {
  bins: { from: number; to: number; n: number }[];
  color?: string;
}) {
  const maxN = Math.max(...bins.map((b) => b.n), 1);
  if (!bins.some((b) => b.n > 0)) return <Empty />;
  return (
    <div className="h-full flex items-end gap-1 pt-5 pb-5 relative">
      {bins.map((b, i) => {
        const h = (b.n / maxN) * 100;
        const showTick =
          i === 0 || i === bins.length - 1 || i === Math.floor(bins.length / 2);
        return (
          <div
            key={i}
            className="flex-1 h-full flex flex-col justify-end relative group/bar"
          >
            <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity z-10 pointer-events-none">
              <div className="bg-[var(--s2)] border border-[var(--b3)] rounded-md px-2 py-1 shadow-lg text-[10px] whitespace-nowrap text-center">
                <div className="font-black text-[var(--t1)]">{b.n}</div>
                <div className="text-[var(--t4)]">
                  {fmtK(b.from)}–{fmtK(b.to)}
                </div>
              </div>
            </div>
            <div
              className="w-full rounded-t-[3px] transition-all duration-300 group-hover/bar:opacity-100"
              style={{
                height: `${Math.max(h, b.n > 0 ? 2 : 0)}%`,
                background: color,
                opacity: 0.85,
              }}
            />
            {showTick && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-[var(--t5)] whitespace-nowrap">
                {fmtK(b.from)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Horizontal labeled bars, biggest first. Items: { label, value, color?, sub? }.
export function BarList({
  items,
  max,
  valueFmt = (v) => v.toLocaleString(),
  barColor = ACCENT,
}: {
  items: { label: string; value: number; color?: string; sub?: string }[];
  max?: number;
  valueFmt?: (v: number) => string;
  barColor?: string;
}) {
  if (!items.length) return <Empty />;
  const top = Math.max(max ?? 0, ...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-[11px] gap-2">
            <span className="text-[var(--t2)] truncate font-semibold capitalize">
              {it.label}
              {it.sub && (
                <span className="ml-1.5 text-[var(--t5)] font-normal lowercase">
                  {it.sub}
                </span>
              )}
            </span>
            <Mono className="text-[var(--t3)] shrink-0">
              {valueFmt(it.value)}
            </Mono>
          </div>
          <div className="h-2 rounded-full bg-[var(--s2)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.max((it.value / top) * 100, 1.5)}%`,
                background: it.color || barColor,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Donut with a legend. Slices: { label, value, color }.
export function Donut({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return <Empty />;
  const r = 36;
  const c = 2 * Math.PI * r;
  let off = 0;
  const ordered = [...slices].sort((a, b) => b.value - a.value);
  return (
    <div className="h-full flex items-center justify-center gap-5">
      <div className="relative w-[104px] h-[104px] shrink-0">
        <svg
          width="104"
          height="104"
          viewBox="0 0 104 104"
          className="-rotate-90"
        >
          {ordered.map((s) => {
            const len = (s.value / total) * c;
            const node = (
              <circle
                key={s.label}
                cx="52"
                cy="52"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="15"
                strokeDasharray={`${len} ${c}`}
                strokeDashoffset={-off}
                className="transition-all duration-500 hover:opacity-80"
              />
            );
            off += len;
            return node;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Mono className="text-base font-black text-[var(--t1)] leading-none">
            {centerValue ?? total}
          </Mono>
          {centerLabel && (
            <span className="text-[9px] text-[var(--t4)] uppercase tracking-wider mt-0.5">
              {centerLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0 max-h-[120px] overflow-y-auto">
        {ordered.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between text-[11px] gap-2"
          >
            <span className="flex items-center gap-1.5 truncate">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-[var(--t2)] truncate capitalize">
                {s.label}
              </span>
            </span>
            <Mono className="text-[var(--t4)] shrink-0">
              {Math.round((s.value / total) * 100)}%
            </Mono>
          </div>
        ))}
      </div>
    </div>
  );
}

// A single stacked horizontal segment bar (e.g. hot/warm/standard tier split).
export function SegmentBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total) return <Empty />;
  return (
    <div className="flex flex-col gap-3 justify-center h-full">
      <div className="flex h-7 rounded-lg overflow-hidden bg-[var(--s2)]">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.label}
              className="h-full transition-all duration-500 grid place-items-center"
              style={{
                width: `${(s.value / total) * 100}%`,
                background: s.color,
              }}
              title={`${s.label}: ${s.value}`}
            >
              {s.value / total > 0.08 && (
                <Mono className="text-[10px] font-black text-black/70">
                  {s.value}
                </Mono>
              )}
            </div>
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 text-[11px] text-[var(--t2)] capitalize"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
            <Mono className="text-[var(--t4)]">
              {Math.round((s.value / total) * 100)}%
            </Mono>
          </span>
        ))}
      </div>
    </div>
  );
}
