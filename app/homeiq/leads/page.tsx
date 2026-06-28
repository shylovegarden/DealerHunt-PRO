"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import Link from "next/link";

const DealerMap = dynamic(() => import("@/components/map/DealerMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center text-[var(--t4)] text-sm">
      Loading map…
    </div>
  ),
});

const ACCENT = "#2dd4bf";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

const TIER_COLOR: Record<string, string> = {
  hot: "var(--red)",
  warm: "var(--amber)",
  standard: "var(--blue)",
};

const TIERS = [
  { key: "", label: "All" },
  { key: "hot", label: "🔥 Hot" },
  { key: "warm", label: "Warm" },
];

interface Lead {
  id: string;
  title: string;
  url?: string;
  price?: number;
  property_type?: string;
  city?: string;
  state?: string;
  image?: string;
  auction_end?: string;
  bid_count?: number;
  score: number;
  tier: string;
  signals: string[];
}

export default function HomeIQLeadsPage() {
  const [tier, setTier] = useState("");
  const { data, isLoading } = useSWR(
    `/api/homeiq/leads?tier=${tier}&limit=150`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 120_000,
    },
  );
  const leads: Lead[] = data?.leads ?? [];
  const points = data?.points ?? [];
  const byTier = data?.byTier ?? { hot: 0, warm: 0, standard: 0 };

  return (
    <main className="min-h-screen bg-[var(--s1)] text-[var(--t1)]">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-[10px] grid place-items-center text-black font-black"
            style={{ background: ACCENT }}
          >
            H
          </span>
          <span className="font-black text-lg">HomeIQ</span>
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            Leads
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-[var(--r3)] bg-[var(--s2)] border border-[var(--b1)]">
            {TIERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTier(t.key)}
                className="px-3 py-1.5 rounded-[var(--r2)] text-xs font-bold transition-colors"
                style={{
                  background: tier === t.key ? ACCENT : "transparent",
                  color: tier === t.key ? "#000" : "var(--t3)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Link
            href="/welcome"
            className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
          >
            ← Switch
          </Link>
        </div>
      </header>

      {/* Stat strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 grid grid-cols-3 gap-3">
        <Stat label="Leads" value={data?.total ?? "—"} accent="var(--t1)" />
        <Stat label="🔥 Hot" value={byTier.hot ?? "—"} accent="var(--red)" />
        <Stat label="Warm" value={byTier.warm ?? "—"} accent="var(--amber)" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid lg:grid-cols-[1fr_minmax(360px,46%)] gap-5">
        {/* Hot-leads feed */}
        <div className="space-y-3 order-2 lg:order-1">
          {isLoading && (
            <p className="text-[var(--t4)] text-sm py-10 text-center">
              Harvesting live leads…
            </p>
          )}
          {!isLoading && leads.length === 0 && (
            <p className="text-[var(--t4)] text-sm py-10 text-center">
              No leads in this filter yet.
            </p>
          )}
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} />
          ))}
        </div>

        {/* Map */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-5 h-[42vh] lg:h-[78vh]">
          <DealerMap points={points} />
        </div>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: any;
  accent: string;
}) {
  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] px-4 py-3">
      <div className="text-2xl font-black" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--t4)]">
        {label}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const color = TIER_COLOR[lead.tier] || "var(--blue)";
  return (
    <a
      href={lead.url || "#"}
      target="_blank"
      rel="noreferrer"
      className="block rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-4 hover:border-[var(--b3)] transition-colors"
    >
      <div className="flex items-start gap-4">
        <ScoreRing score={lead.score} color={color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: `${color}22`, color }}
            >
              {lead.tier}
            </span>
            <span className="text-xs text-[var(--t4)] capitalize">
              {(lead.property_type || "").replace("_", " ")}
            </span>
          </div>
          <h3 className="font-bold text-[var(--t1)] mt-1 truncate">
            {lead.title}
          </h3>
          <div className="text-sm text-[var(--t3)] mt-0.5">
            <span className="font-black text-[var(--t1)]">
              ${(lead.price || 0).toLocaleString()}
            </span>
            {lead.city
              ? ` · ${lead.city}, ${lead.state || ""}`
              : lead.state
                ? ` · ${lead.state}`
                : ""}
            {typeof lead.bid_count === "number"
              ? ` · ${lead.bid_count} bids`
              : ""}
          </div>
          {lead.signals?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {lead.signals.slice(0, 3).map((s, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--s2)] text-[var(--t2)] border border-[var(--b1)]"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: 46, height: 46 }}>
      <svg width="46" height="46" viewBox="0 0 46 46" className="-rotate-90">
        <circle
          cx="23"
          cy="23"
          r={r}
          fill="none"
          stroke="var(--b1)"
          strokeWidth="4"
        />
        <circle
          cx="23"
          cy="23"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <span
        className="absolute inset-0 grid place-items-center text-sm font-black"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}
