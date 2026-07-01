"use client";

import React from "react";
import Link from "next/link";
import { Mono } from "@/components/shared/Mono";

// Lightweight, dependency-free chart primitives for the HomeIQ market dashboard. Pure SVG/CSS so we add
// zero packages (the project ships no charting lib) and match the cars-side custom visualizers. Styled in
// the HomeIQ language: glass panels, teal accent, --t*/--b*/--s* tokens.

export const ACCENT = "#2dd4bf";

// Wrap a chart row in a Link when an href is given (deep-link into the filtered leads view), otherwise
// render it inert. Keeps every chart primitive optionally actionable without duplicating markup.
function MaybeLink({
  href,
  className = "",
  style,
  title,
  children,
}: {
  href?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  children: React.ReactNode;
}) {
  if (!href)
    return (
      <div className={className} style={style} title={title}>
        {children}
      </div>
    );
  return (
    <Link href={href} className={className} style={style} title={title}>
      {children}
    </Link>
  );
}

export function ChartCard({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-4 flex flex-col gap-3 ${className}`}
    >
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
  items: {
    label: string;
    value: number;
    color?: string;
    sub?: string;
    href?: string;
  }[];
  max?: number;
  valueFmt?: (v: number) => string;
  barColor?: string;
}) {
  if (!items.length) return <Empty />;
  const top = Math.max(max ?? 0, ...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {items.map((it) => (
        <MaybeLink
          key={it.label}
          href={it.href}
          className={`flex flex-col gap-1 ${it.href ? "group/row -mx-1 px-1 rounded-md hover:bg-[var(--s2)]/60 transition-colors" : ""}`}
        >
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
        </MaybeLink>
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
  slices: { label: string; value: number; color: string; href?: string }[];
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
          <MaybeLink
            key={s.label}
            href={s.href}
            className={`flex items-center justify-between text-[11px] gap-2 ${s.href ? "-mx-1 px-1 rounded hover:bg-[var(--s2)]/60 transition-colors" : ""}`}
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
          </MaybeLink>
        ))}
      </div>
    </div>
  );
}

// Price-vs-sqft scatter with a least-squares trend line — the housing twin of the cars price/miles
// scatter. Each lead is a dot; dots BELOW the $/sqft trend line are underpriced (green), the rest grey.
// Dots are positioned divs (stay round at any aspect ratio); the trend line is a stretch-to-fit SVG.
export function Scatter({
  points,
  xLabel = "sqft",
  yLabel = "price",
}: {
  points: { x: number; y: number }[];
  xLabel?: string;
  yLabel?: string;
}) {
  if (points.length < 6) return <Empty />;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  // Least-squares fit y = a·x + b.
  const n = points.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = points.reduce((a, p) => a + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  const slope = denom ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  const px = (x: number) =>
    xMax === xMin ? 50 : ((x - xMin) / (xMax - xMin)) * 100;
  const py = (y: number) =>
    yMax === yMin ? 50 : 100 - ((y - yMin) / (yMax - yMin)) * 100;
  const under = points.filter((p) => p.y < slope * p.x + intercept).length;
  const underPct = Math.round((under / n) * 100);
  return (
    <div className="h-full flex flex-col">
      <div className="relative flex-1 min-h-[150px] rounded-md bg-[var(--s1)] overflow-hidden">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          <line
            x1={px(xMin)}
            y1={py(slope * xMin + intercept)}
            x2={px(xMax)}
            y2={py(slope * xMax + intercept)}
            stroke="var(--amber)"
            strokeWidth="1"
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, i) => {
          const isUnder = p.y < slope * p.x + intercept;
          return (
            <span
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${px(p.x)}%`,
                top: `${py(p.y)}%`,
                background: isUnder ? "var(--green)" : "var(--t4)",
                opacity: isUnder ? 0.9 : 0.4,
              }}
            />
          );
        })}
        <span className="absolute top-1.5 right-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[var(--s0)]/80 text-[var(--green)]">
          {underPct}% under the curve
        </span>
      </div>
      <div className="flex justify-between text-[9px] text-[var(--t5)] mt-1.5">
        <span>↑ {yLabel}</span>
        <span>{xLabel} →</span>
      </div>
    </div>
  );
}

// Diverging waterfall — bars grow right (green) for positive values and left (red) for negative, around a
// center zero line. Used for median equity by property type (some types are money-losers = negative).
export function Waterfall({
  items,
  valueFmt = (v) => v.toLocaleString(),
}: {
  items: { label: string; value: number; href?: string }[];
  valueFmt?: (v: number) => string;
}) {
  if (!items.length) return <Empty />;
  const mag = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {items.map((it) => {
        const pos = it.value >= 0;
        const w = (Math.abs(it.value) / mag) * 50; // half-width each side of center
        return (
          <MaybeLink
            key={it.label}
            href={it.href}
            className={`flex flex-col gap-1 ${it.href ? "group/row -mx-1 px-1 rounded-md hover:bg-[var(--s2)]/60 transition-colors" : ""}`}
          >
            <div className="flex items-baseline justify-between text-[11px] gap-2">
              <span className="text-[var(--t2)] truncate font-semibold capitalize">
                {it.label}
              </span>
              <Mono
                className="shrink-0"
                style={{ color: pos ? "var(--green)" : "var(--red)" }}
              >
                {pos ? "+" : "−"}
                {valueFmt(Math.abs(it.value))}
              </Mono>
            </div>
            <div className="relative h-2.5 rounded-full bg-[var(--s2)] overflow-hidden">
              {/* center zero line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--b3)]" />
              <div
                className="absolute top-0 bottom-0 rounded-full transition-all duration-500"
                style={{
                  background: pos ? "var(--green)" : "var(--red)",
                  left: pos ? "50%" : `${50 - w}%`,
                  width: `${w}%`,
                }}
              />
            </div>
          </MaybeLink>
        );
      })}
    </div>
  );
}

// A single stacked horizontal segment bar (e.g. hot/warm/standard tier split).
export function SegmentBar({
  segments,
}: {
  segments: { label: string; value: number; color: string; href?: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total) return <Empty />;
  return (
    <div className="flex flex-col gap-3 justify-center h-full">
      <div className="flex h-7 rounded-lg overflow-hidden bg-[var(--s2)]">
        {segments.map((s) =>
          s.value > 0 ? (
            <MaybeLink
              key={s.label}
              href={s.href}
              title={`${s.label}: ${s.value}`}
              className={`h-full transition-all duration-500 grid place-items-center ${s.href ? "hover:opacity-80" : ""}`}
              style={{
                width: `${(s.value / total) * 100}%`,
                background: s.color,
              }}
            >
              {s.value / total > 0.08 && (
                <Mono className="text-[10px] font-black text-black/70">
                  {s.value}
                </Mono>
              )}
            </MaybeLink>
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
