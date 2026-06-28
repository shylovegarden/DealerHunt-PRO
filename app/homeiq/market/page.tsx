"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { stateName } from "@/lib/housing/us-states";
import {
  ACCENT,
  ChartCard,
  Histogram,
  BarList,
  Donut,
  SegmentBar,
} from "@/components/home/HousingCharts";
import { HousingHeatmap } from "@/components/home/HousingHeatmap";
import { summarizeMarket, type MarketLead } from "@/lib/housing/market-stats";

// HomeIQ Market Intelligence — a read-only analytics view over the whole scored housing market. Reuses
// the existing /api/homeiq/leads endpoint (which already returns the full 2000-row market plus byState/
// bySource/byTier), so it adds no server route. Pure client-side aggregation into dependency-free charts.

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const SOURCE_LABELS: Record<string, string> = {
  gov_auction: "Gov auction",
  hud: "HUD Homes",
  gsa_realestate: "GSA Real Estate",
  redfin: "Redfin",
  land_bank: "Land banks",
};
const sourceLabel = (s: string) =>
  SOURCE_LABELS[s] ||
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const typeLabel = (t: string) =>
  ({
    single_family: "Single-family",
    multi_family: "Multi-family",
    condo: "Condo",
    land: "Land",
    townhouse: "Townhouse",
    mobile: "Mobile",
  })[t] ||
  (t ? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Other");

// A rotating palette for categorical slices/bars (sources, property types).
const PALETTE = [
  ACCENT,
  "var(--blue)",
  "var(--amber)",
  "var(--green)",
  "#a78bfa",
  "#f472b6",
  "#fb923c",
  "var(--red)",
];

const TIER_COLOR: Record<string, string> = {
  hot: "var(--red)",
  warm: "var(--amber)",
  standard: "var(--blue)",
};

const VERDICT = [
  { key: "strong", label: "Strong", color: "var(--green)" },
  { key: "fair", label: "Fair", color: ACCENT },
  { key: "tight", label: "Tight", color: "var(--amber)" },
  { key: "pass", label: "Pass", color: "var(--red)" },
];

type Lead = MarketLead & { id: string; score: number };

const fmtMoney = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `$${Math.round(n / 1000)}k`
      : `$${n}`;

export default function MarketIntelligence() {
  const { data, isLoading } = useSWR(`/api/homeiq/leads?limit=2000`, fetcher, {
    revalidateOnFocus: false,
  });
  const leads: Lead[] = data?.leads ?? [];

  const f = useMemo(() => summarizeMarket(leads), [leads]);

  const total = leads.length;
  const sourceItems = Object.entries(f.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n], i) => ({
      label: sourceLabel(s),
      value: n,
      color: PALETTE[i % PALETTE.length],
      href: `/homeiq/leads?source=${encodeURIComponent(s)}`,
    }));

  const stateItems = Object.entries(f.byState)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([s, n]) => ({
      label: stateName(s),
      value: n,
      href: `/homeiq/leads?state=${encodeURIComponent(s)}`,
    }));

  const typeSlices = Object.entries(f.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n], i) => ({
      label: typeLabel(t),
      value: n,
      color: PALETTE[i % PALETTE.length],
      href: `/homeiq/leads?type=${encodeURIComponent(t)}`,
    }));

  const tierSegs = [
    {
      label: "Hot",
      value: f.byTier.hot,
      color: TIER_COLOR.hot,
      href: "/homeiq/leads?tier=hot",
    },
    {
      label: "Warm",
      value: f.byTier.warm,
      color: TIER_COLOR.warm,
      href: "/homeiq/leads?tier=warm",
    },
    {
      label: "Standard",
      value: f.byTier.standard,
      color: TIER_COLOR.standard,
      href: "/homeiq/leads?tier=standard",
    },
  ];

  const verdictItems = VERDICT.map((v) => ({
    label: v.label,
    value: f.byVerdict[v.key] || 0,
    color: v.color,
  })).filter((v) => v.value > 0);

  return (
    <main className="min-h-screen bg-[var(--s1)] text-[var(--t1)]">
      <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/homeiq" className="flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-[10px] grid place-items-center text-black font-black"
              style={{ background: ACCENT }}
            >
              H
            </span>
            <span className="font-black text-lg">HomeIQ</span>
          </Link>
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            Market
          </span>
        </div>
        <Link
          href="/homeiq/leads"
          className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
        >
          Browse leads →
        </Link>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <h1 className="text-[clamp(26px,4vw,40px)] font-black leading-tight">
          Market intelligence
        </h1>
        <p className="mt-2 text-[var(--t3)]">
          The whole scored housing market at a glance — pricing, supply, and
          flip opportunity across every free source.
        </p>

        {/* KPI row */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Live leads" value={total.toLocaleString()} />
          <Kpi
            label="Median price"
            value={f.medianPrice ? fmtMoney(f.medianPrice) : "—"}
            accent={ACCENT}
          />
          <Kpi
            label="🔥 Hot"
            value={f.byTier.hot.toLocaleString()}
            accent="var(--red)"
          />
          <Kpi
            label="Flip-ready"
            value={f.flippable.toLocaleString()}
            accent="var(--green)"
            hint="positive equity"
          />
          <Kpi label="Sources" value={Object.keys(f.bySource).length || "—"} />
          <Kpi label="Markets" value={Object.keys(f.byState).length || "—"} />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {isLoading && !total ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] h-[200px] animate-pulse"
              />
            ))}
          </div>
        ) : !total ? (
          <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-10 text-center text-[var(--t4)]">
            No market data yet.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <HousingHeatmap byState={f.byState} byStateHot={f.byStateHot} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ChartCard
                title="Price distribution"
                hint={`${f.priced.length.toLocaleString()} priced`}
              >
                <Histogram bins={f.bins} />
              </ChartCard>

              <ChartCard title="Inventory by source">
                <BarList items={sourceItems} />
              </ChartCard>

              <ChartCard title="Property type mix">
                <Donut
                  slices={typeSlices}
                  centerValue={total}
                  centerLabel="leads"
                />
              </ChartCard>

              <ChartCard title="Top markets" hint="by listings">
                <BarList items={stateItems} barColor="var(--blue)" />
              </ChartCard>

              <ChartCard title="Lead quality">
                <SegmentBar segments={tierSegs} />
              </ChartCard>

              <ChartCard
                title="Flip opportunity"
                hint="70% rule, where ARV is known"
              >
                {verdictItems.length ? (
                  <BarList items={verdictItems} />
                ) : (
                  <div className="h-full grid place-items-center text-xs text-[var(--t5)] text-center px-4">
                    No flip math yet — needs square-footage to compute ARV.
                  </div>
                )}
              </ChartCard>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  accent = "var(--t1)",
  hint,
}: {
  label: string;
  value: string | number;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] px-4 py-3">
      <div className="text-xl sm:text-2xl font-black" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--t4)] mt-0.5">
        {label}
      </div>
      {hint && <div className="text-[9px] text-[var(--t5)] mt-0.5">{hint}</div>}
    </div>
  );
}
