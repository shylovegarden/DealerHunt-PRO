"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import Link from "next/link";

// Market-leading housing browse — adapts the Zillow/Redfin split map+list + photo-forward cards, with
// PropStream-style lead-signal focus (score + distress signals + the 70%-rule max offer). All filtering/
// sorting is instant (client-side over a single fetch), like the best portals.

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
const VERDICT_COLOR: Record<string, string> = {
  strong: "var(--green)",
  fair: ACCENT,
  tight: "var(--amber)",
  pass: "var(--red)",
};

const TIERS = [
  { key: "", label: "All" },
  { key: "hot", label: "🔥 Hot" },
  { key: "warm", label: "Warm" },
];
const TYPES = [
  { key: "", label: "Any type" },
  { key: "single_family", label: "Single-family" },
  { key: "multi_family", label: "Multi-family" },
  { key: "land", label: "Land" },
];
const SORTS = [
  { key: "score", label: "Hottest" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "ending", label: "Ending soon" },
];
const PRICES = [
  { key: 0, label: "Any price" },
  { key: 25000, label: "≤ $25k" },
  { key: 50000, label: "≤ $50k" },
  { key: 100000, label: "≤ $100k" },
];

interface Lead {
  id: string;
  title: string;
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
  mao?: number | null;
  verdict?: string;
}

export default function HomeIQLeadsPage() {
  const [tier, setTier] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("score");
  const [maxPrice, setMaxPrice] = useState(0);
  const [q, setQ] = useState("");

  const { data, isLoading } = useSWR(`/api/homeiq/leads?limit=300`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  });
  const all: Lead[] = data?.leads ?? [];
  const points = data?.points ?? [];
  const byTier = data?.byTier ?? { hot: 0, warm: 0, standard: 0 };

  const leads = useMemo(() => {
    let r = all;
    if (tier) r = r.filter((l) => l.tier === tier);
    if (type) r = r.filter((l) => l.property_type === type);
    if (maxPrice) r = r.filter((l) => (l.price || 0) <= maxPrice);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      r = r.filter((l) =>
        `${l.city} ${l.state} ${l.title}`.toLowerCase().includes(t),
      );
    }
    const s = [...r];
    if (sort === "price_asc") s.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sort === "price_desc")
      s.sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (sort === "ending")
      s.sort((a, b) =>
        (a.auction_end || "z").localeCompare(b.auction_end || "z"),
      );
    else s.sort((a, b) => b.score - a.score);
    return s;
  }, [all, tier, type, maxPrice, q, sort]);

  // Map shows the filtered set (ids → points).
  const visibleIds = new Set(leads.map((l) => l.id));
  const mapPoints = points.filter((p: any) => visibleIds.has(p.id));

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
        <Link
          href="/welcome"
          className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
        >
          ← Switch
        </Link>
      </header>

      {/* Filter bar — Zillow/Redfin pattern */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 flex items-center gap-2 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search city, state…"
          className="flex-1 min-w-[160px] px-4 py-2 rounded-[var(--r3)] bg-[var(--s0)] border border-[var(--b1)] text-sm focus:outline-none focus:border-[var(--b3)]"
        />
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
        <Select value={type} onChange={setType} options={TYPES} />
        <Select
          value={String(maxPrice)}
          onChange={(v) => setMaxPrice(Number(v))}
          options={PRICES.map((p) => ({ key: String(p.key), label: p.label }))}
        />
        <Select value={sort} onChange={setSort} options={SORTS} />
      </div>

      {/* Stat strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 grid grid-cols-3 gap-3">
        <Stat label="Showing" value={leads.length} accent="var(--t1)" />
        <Stat label="🔥 Hot" value={byTier.hot ?? "—"} accent="var(--red)" />
        <Stat label="Warm" value={byTier.warm ?? "—"} accent="var(--amber)" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid lg:grid-cols-[1fr_minmax(360px,46%)] gap-5">
        <div className="space-y-3 order-2 lg:order-1">
          {isLoading && (
            <p className="text-[var(--t4)] text-sm py-10 text-center">
              Harvesting live leads…
            </p>
          )}
          {!isLoading && leads.length === 0 && (
            <p className="text-[var(--t4)] text-sm py-10 text-center">
              No leads match these filters.
            </p>
          )}
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} />
          ))}
        </div>
        <div className="order-1 lg:order-2 lg:sticky lg:top-5 h-[42vh] lg:h-[78vh]">
          <DealerMap points={mapPoints} />
        </div>
      </div>
    </main>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-[var(--r3)] bg-[var(--s0)] border border-[var(--b1)] text-xs font-bold text-[var(--t2)] focus:outline-none focus:border-[var(--b3)] cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
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

// Photo-forward card (Zillow/Redfin style) — image left with score badge, details right.
function LeadCard({ lead }: { lead: Lead }) {
  const color = TIER_COLOR[lead.tier] || "var(--blue)";
  return (
    <Link
      href={`/homeiq/leads/${encodeURIComponent(lead.id)}`}
      className="flex gap-3 rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-3 hover:border-[var(--b3)] transition-colors"
    >
      <div className="relative shrink-0 w-28 h-24 rounded-[var(--r2)] overflow-hidden bg-[var(--s2)]">
        {lead.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lead.image}
            alt={lead.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-[var(--t4)] text-[10px]">
            No photo
          </div>
        )}
        <span
          className="absolute top-1 left-1 text-[11px] font-black px-1.5 py-0.5 rounded text-white"
          style={{ background: color }}
        >
          {lead.score}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}22`, color }}
          >
            {lead.tier}
          </span>
          <span className="text-[11px] text-[var(--t4)] capitalize">
            {(lead.property_type || "").replace("_", " ")}
          </span>
        </div>
        <div className="font-black text-[var(--t1)] mt-0.5">
          ${(lead.price || 0).toLocaleString()}
          <span className="font-medium text-sm text-[var(--t3)]">
            {lead.city
              ? ` · ${lead.city}, ${lead.state || ""}`
              : lead.state
                ? ` · ${lead.state}`
                : ""}
          </span>
        </div>
        <h3 className="text-sm text-[var(--t2)] truncate">{lead.title}</h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {lead.mao != null && (
            <span
              className="text-[11px] font-bold"
              style={{ color: VERDICT_COLOR[lead.verdict || ""] || ACCENT }}
            >
              Max offer ${lead.mao.toLocaleString()} · {lead.verdict}
            </span>
          )}
          {(lead.signals || [])
            .slice(0, lead.mao != null ? 1 : 2)
            .map((s, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--s2)] text-[var(--t3)] border border-[var(--b1)]"
              >
                {s}
              </span>
            ))}
        </div>
      </div>
    </Link>
  );
}
