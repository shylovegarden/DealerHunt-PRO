"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { US_STATES as ST, nearbyStates } from "@/lib/housing/us-states";
import { housingPriceTerms } from "@/lib/housing/price-semantics";
import {
  readHomeCondition,
  HOME_CONDITION_TIER_COLOR,
} from "@/lib/housing/condition";
import { LEAD_CATEGORIES, leadCategories } from "@/lib/housing/categories";

// Market-leading housing browse — Zillow/Redfin split map+list + photo-forward cards + PropStream-style
// lead signals. LOCATION-FIRST + PROGRESSIVE: scoped to your state shows it IMMEDIATELY, then "Nearby"
// widens to the geographically-closest states, then "Nationwide" — and within any scope the list
// EXTENDS as you scroll (infinite). All instant (client-side over one fetch).

const DealerMap = dynamic(() => import("@/components/map/DealerMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center text-[var(--t4)] text-sm">
      Loading map…
    </div>
  ),
});

const ACCENT = "var(--home)";
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
const CASHFLOW_COLOR: Record<string, string> = {
  strong: "var(--green)",
  decent: ACCENT,
  thin: "var(--amber)",
  negative: "var(--red)",
};
// Compact money for dense cards: $90k, $1.2M.
const shortMoney = (n?: number | null) =>
  n == null
    ? "—"
    : Math.abs(n) >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : Math.abs(n) >= 1000
        ? `$${Math.round(n / 1000)}k`
        : `$${Math.round(n)}`;

// Direct-mail / CRM export — the wholesaler's workflow: filter distressed → export → mail-merge. Builds a
// CSV from the CURRENT filtered set (owner + mailing where public records supplied it, plus the deal math).
function exportLeadsCsv(leads: Lead[]) {
  if (!leads.length) return;
  const cols = [
    "Score",
    "Tier",
    "Property Address",
    "City",
    "State",
    "ZIP",
    "Price",
    "Owner",
    "Owner Mailing",
    "Tax Owed",
    "Years Owed",
    "Foreclosure",
    "Vacant",
    "Absentee",
    "Flip Max Offer",
    "Verdict",
    "Cap Rate %",
    "Cashflow/mo",
    "Source",
    "URL",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = leads.map((l) =>
    [
      l.score,
      l.tier,
      l.address,
      l.city,
      l.state,
      l.zip,
      l.price,
      l.owner,
      l.ownerMailing,
      l.distress?.totalDue,
      l.distress?.yearsOwed,
      l.distress?.foreclosure ? "yes" : "",
      (l.distress as any)?.vacant ? "yes" : "",
      l.distress?.outOfState ? "yes" : "",
      l.mao,
      l.verdict,
      l.capRate,
      l.cashflowMo,
      l.source,
      l.url || "",
    ]
      .map(esc)
      .join(","),
  );
  const csv = [cols.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `homeiq-leads-${leads.length}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${leads.length} leads`, {
    description: "Owner + mailing + deal math — ready for mail-merge.",
  });
}

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
const PAGE = 60;

// Friendly labels for the raw `source` values stored on each property.
const SOURCE_LABELS: Record<string, string> = {
  gov_auction: "Gov auction",
  hud: "HUD Homes",
  gsa_realestate: "GSA Real Estate",
  redfin: "Redfin",
  land_bank: "Land banks",
  tax_delinquent: "Tax-delinquent",
  code_violation: "Code violations",
  absentee_owner: "Absentee owner",
  mls: "MLS",
  fannie_homepath: "Fannie REO",
  hud_reo: "HUD REO",
  foreclosure: "Foreclosure",
  dangerous_building: "Dangerous building",
  vacant_building: "Vacant building",
  zillow: "Zillow",
  realtor: "Realtor.com",
  homes: "Homes.com",
  movoto: "Movoto",
  trulia: "Trulia",
};
const sourceLabel = (s: string) =>
  SOURCE_LABELS[s] ||
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Color a land-bank listing status so users can triage move-in-ready vs gut-job vs vacant lot at a glance.
function statusColor(s: string): string {
  const t = s.toLowerCase();
  if (/move-?in|renovated|available soon|new construction/.test(t))
    return "var(--green)";
  if (/pending|under contract|transfer/.test(t)) return "var(--blue)";
  if (/renovation|needs|rehab|fixer/.test(t)) return "var(--amber)";
  if (/vacant|lot|land/.test(t)) return "var(--t4)";
  return "var(--t3)";
}

interface Lead {
  id: string;
  title: string;
  url?: string;
  price?: number;
  source?: string;
  status?: string;
  property_type?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  image?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  year_built?: number;
  daysOnMarket?: number;
  pricePerSqft?: number;
  owner?: string;
  ownerMailing?: string;
  stack?: number;
  distress?: {
    totalDue?: number;
    yearsOwed?: number;
    sheriffSale?: boolean;
    foreclosure?: boolean;
    bankruptcy?: boolean;
    belowMarket?: boolean;
    violations?: number;
    outOfState?: boolean;
    ownerState?: string;
  };
  auction_end?: string;
  bid_count?: number;
  score: number;
  tier: string;
  signals: string[];
  mao?: number | null;
  arv?: number | null;
  equity?: number | null;
  verdict?: string;
  capRate?: number | null;
  cashflowMo?: number | null;
  cashflowRating?: string;
}

export default function HomeIQLeadsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--s1)]" />}>
      <LeadsInner />
    </Suspense>
  );
}

function LeadsInner() {
  const params = useSearchParams();
  const scopeState = (params.get("state") || "").toUpperCase();
  const [scopeMode, setScopeMode] = useState<"state" | "nearby" | "national">(
    scopeState ? "state" : "national",
  );
  // Initialize filters from the URL so deep-links from the Market dashboard land pre-filtered.
  const [tier, setTier] = useState(params.get("tier") || "");
  const [type, setType] = useState(params.get("type") || "");
  const [source, setSource] = useState(params.get("source") || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [sort, setSort] = useState("score");
  const [maxPrice, setMaxPrice] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [q, setQ] = useState(params.get("q") || ""); // pre-filled by the city/ZIP front-door search
  const [visible, setVisible] = useState(PAGE);

  // SERVER-SIDE SCOPE: fetch the current scope from the full 54k (your state / nearby / national top),
  // then filter/sort/search instantly client-side WITHIN that slice. Re-fetches when the scope changes.
  const fetchUrl = useMemo(() => {
    if (!scopeState || scopeMode === "national") return "/api/homeiq/leads";
    if (scopeMode === "nearby")
      return `/api/homeiq/leads?states=${Array.from(nearbyStates(scopeState, 6)).join(",")}`;
    return `/api/homeiq/leads?state=${scopeState}`;
  }, [scopeState, scopeMode]);
  const { data, isLoading } = useSWR(fetchUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
    keepPreviousData: true,
  });
  const all: Lead[] = data?.leads ?? [];
  const points = data?.points ?? [];
  const byState: Record<string, number> = data?.byState ?? {};
  const bySource: Record<string, number> = data?.bySource ?? {};

  // Source dropdown options, most-populous first, with a friendly label + count.
  const sourceOptions = useMemo(
    () => [
      { key: "", label: "All sources" },
      ...Object.entries(bySource)
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => ({ key: s, label: `${sourceLabel(s)} (${n})` })),
    ],
    [bySource],
  );

  // The geographic scope set (null = nationwide).
  const scopeSet = useMemo<Set<string> | null>(() => {
    if (!scopeState || scopeMode === "national") return null;
    return scopeMode === "nearby"
      ? nearbyStates(scopeState, 6)
      : new Set([scopeState]);
  }, [scopeState, scopeMode]);

  const leads = useMemo(() => {
    let r = all; // already scoped server-side (state/nearby/national) — just refine within the slice
    if (tier) r = r.filter((l) => l.tier === tier);
    if (type) r = r.filter((l) => l.property_type === type);
    if (source) r = r.filter((l) => l.source === source);
    if (category === "stacked") r = r.filter((l) => (l.stack || 0) >= 2);
    else if (category)
      r = r.filter((l) => leadCategories(l).includes(category));
    if (maxPrice) r = r.filter((l) => (l.price || 0) <= maxPrice);
    if (minPrice) r = r.filter((l) => (l.price || 0) >= minPrice);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      // Match address + ZIP + city/state + title + the distress signal text, so typing a street, a ZIP,
      // or a keyword like "vacant"/"foreclosure" all work (people expect a property search to honor these).
      r = r.filter((l) =>
        `${l.address || ""} ${l.zip || ""} ${l.city || ""} ${l.state || ""} ${l.title || ""} ${(l.signals || []).join(" ")}`
          .toLowerCase()
          .includes(t),
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
  }, [
    all,
    scopeSet,
    tier,
    type,
    source,
    category,
    maxPrice,
    minPrice,
    q,
    sort,
  ]);

  // Reset the visible window whenever the result set changes.
  useEffect(
    () => setVisible(PAGE),
    [scopeSet, tier, type, source, category, maxPrice, minPrice, q, sort],
  );

  // Infinite scroll — extend the list as the sentinel comes into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting)
          setVisible((v) => (v < leads.length ? v + PAGE : v));
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [leads.length]);

  const shown = leads.slice(0, visible);
  const visibleIds = new Set(shown.map((l) => l.id));
  const mapPoints = points.filter((p: any) => visibleIds.has(p.id));
  const nearbyCount = scopeState
    ? Object.keys(byState)
        .filter((s) => nearbyStates(scopeState, 6).has(s))
        .reduce((n, s) => n + byState[s], 0)
    : 0;

  return (
    <main className="min-h-screen bg-[var(--s1)] text-[var(--t1)]">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-[10px] grid place-items-center text-black font-black shadow-[var(--shadow2)]"
            style={{ background: "var(--grad-home)" }}
          >
            H
          </span>
          <span className="font-black text-lg">HomeIQ</span>
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: "var(--home-lo)", color: ACCENT }}
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

      {/* Location scope — progressive: your state → nearby → nationwide */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 flex items-center justify-between gap-2 flex-wrap">
        {scopeState ? (
          <div className="flex items-center gap-1.5 p-1 rounded-[var(--r3)] bg-[var(--s2)] border border-[var(--b1)] text-xs font-bold">
            {(
              [
                ["state", `📍 ${ST[scopeState]?.[0] || scopeState}`],
                ["nearby", `Nearby${nearbyCount ? ` (${nearbyCount})` : ""}`],
                ["national", "Nationwide"],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setScopeMode(k)}
                className="px-3 py-1.5 rounded-[var(--r2)] transition-colors"
                style={{
                  background: scopeMode === k ? ACCENT : "transparent",
                  color: scopeMode === k ? "#000" : "var(--t3)",
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm font-bold text-[var(--t2)]">
            Nationwide — top leads
          </span>
        )}
        <div className="flex items-center gap-4">
          <AlertButton
            criteria={{
              name:
                [scopeState, type, source].filter(Boolean).join(" ") ||
                "All deals",
              state: scopeState || undefined,
              property_type: type || undefined,
              source: source || undefined,
              tier: tier || undefined,
              max_price: maxPrice || undefined,
            }}
          />
          <button
            onClick={() => exportLeadsCsv(leads)}
            disabled={!leads.length}
            className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)] disabled:opacity-40"
            title="Download the current filtered leads as a direct-mail / CRM-ready CSV"
          >
            ⬇ Export CSV
          </button>
          <Link
            href="/homeiq/saved"
            className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
          >
            📋 Pipeline
          </Link>
          <Link
            href="/homeiq/states"
            className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
          >
            🗺️ Browse all states
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 flex items-center gap-2 flex-wrap">
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
        <Select value={source} onChange={setSource} options={sourceOptions} />
        {/* Price RANGE (min + max) — was max-only, capped at $100k. */}
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-[var(--r3)] bg-[var(--s0)] border border-[var(--b1)] text-xs font-bold text-[var(--t2)]">
          <span className="text-[var(--t4)]">$</span>
          <input
            type="number"
            inputMode="numeric"
            value={minPrice || ""}
            onChange={(e) => setMinPrice(Number(e.target.value) || 0)}
            placeholder="Min"
            className="w-16 bg-transparent focus:outline-none"
            aria-label="Min price"
          />
          <span className="text-[var(--t4)]">–</span>
          <input
            type="number"
            inputMode="numeric"
            value={maxPrice || ""}
            onChange={(e) => setMaxPrice(Number(e.target.value) || 0)}
            placeholder="Max"
            className="w-16 bg-transparent focus:outline-none"
            aria-label="Max price"
          />
        </div>
        <Select value={sort} onChange={setSort} options={SORTS} />
      </div>

      {/* Quick Lists — PropStream-style lead categories (vacant / absentee / tax-delinquent / REO …). */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setCategory("")}
          className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
          style={{
            background: category === "" ? ACCENT : "var(--s2)",
            color: category === "" ? "#000" : "var(--t3)",
            border: "1px solid var(--b1)",
          }}
        >
          All leads
        </button>
        {(() => {
          const stacked = all.filter((l) => (l.stack || 0) >= 2).length;
          if (stacked === 0) return null;
          return (
            <button
              onClick={() =>
                setCategory(category === "stacked" ? "" : "stacked")
              }
              className="px-3 py-1.5 rounded-full text-xs font-black transition-colors"
              style={{
                background: category === "stacked" ? "var(--red)" : "var(--s2)",
                color: category === "stacked" ? "#fff" : "var(--red)",
                border: "1px solid var(--red)",
              }}
              title="On 2+ distress lists — the most motivated sellers"
            >
              📚 Stacked{" "}
              <span style={{ opacity: 0.7 }}>{stacked.toLocaleString()}</span>
            </button>
          );
        })()}
        {LEAD_CATEGORIES.map((c) => {
          const count = all.filter((l) =>
            leadCategories(l).includes(c.key),
          ).length;
          if (count === 0) return null;
          return (
            <button
              key={c.key}
              onClick={() => setCategory(category === c.key ? "" : c.key)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
              style={{
                background: category === c.key ? ACCENT : "var(--s2)",
                color: category === c.key ? "#000" : "var(--t3)",
                border: "1px solid var(--b1)",
              }}
            >
              {c.label}{" "}
              <span style={{ opacity: 0.6 }}>{count.toLocaleString()}</span>
            </button>
          );
        })}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 text-xs font-bold uppercase tracking-widest text-[var(--t4)]">
        {leads.length.toLocaleString()} leads{scopeSet ? "" : " (top)"} ·
        showing {shown.length}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 grid lg:grid-cols-[1fr_minmax(360px,46%)] gap-5">
        <div className="space-y-3 order-2 lg:order-1">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          {!isLoading && leads.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-[var(--t2)] font-bold">No leads match</p>
              <p className="text-[var(--t4)] text-sm mt-1">
                Try widening the scope or clearing a filter.
              </p>
            </div>
          )}
          {shown.map((l, i) => (
            <LeadCard key={l.id} lead={l} index={i} />
          ))}
          <div ref={sentinel} className="h-8" />
          {visible < leads.length && (
            <button
              onClick={() => setVisible((v) => v + PAGE)}
              className="w-full py-2.5 rounded-[var(--r3)] border border-[var(--b1)] text-sm font-bold text-[var(--t3)] hover:border-[var(--b3)]"
            >
              Load more ({leads.length - visible} more)
            </button>
          )}
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

// Quick-save a lead to the pipeline straight from the list — no need to open the detail page. Stops the
// card's link navigation. 401 → bounce to sign-in.
function QuickSave({ listingId }: { listingId: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const save = async (e: {
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    e.preventDefault();
    e.stopPropagation();
    if (state !== "idle") return;
    setState("saving");
    const res = await fetch("/api/homeiq/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    if (res.status === 401) {
      window.location.href = "/";
      return;
    }
    if (res.ok) {
      toast.success("Saved to pipeline 📋");
      setState("saved");
    } else setState("idle");
  };
  return (
    <button
      onClick={save}
      title={state === "saved" ? "In your pipeline" : "Save to pipeline"}
      aria-label="Save to pipeline"
      className="absolute top-1.5 right-1.5 z-[1] w-7 h-7 grid place-items-center rounded-full text-sm border transition-colors"
      style={
        state === "saved"
          ? { background: ACCENT, borderColor: ACCENT, color: "#000" }
          : {
              background: "var(--s0)",
              borderColor: "var(--b1)",
              color: "var(--t3)",
            }
      }
    >
      {state === "saved" ? "✓" : state === "saving" ? "…" : "♡"}
    </button>
  );
}

// Turn the current search into an instant-alert: the app emails you when a NEW hot/warm match appears.
function AlertButton({ criteria }: { criteria: Record<string, unknown> }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "auth">(
    "idle",
  );
  async function save() {
    setState("saving");
    try {
      const r = await fetch("/api/homeiq/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      if (r.status === 401) return setState("auth");
      if (r.ok) {
        toast.success("Alert set 🔔", {
          description: "We'll email you when a new matching deal appears.",
        });
        setState("done");
      } else setState("idle");
    } catch {
      setState("idle");
    }
  }
  if (state === "done")
    return (
      <span className="text-sm font-semibold text-[var(--green)]">
        🔔 Alert on ✓
      </span>
    );
  if (state === "auth")
    return (
      <Link
        href="/login"
        className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
      >
        Sign in to set alerts
      </Link>
    );
  return (
    <button
      onClick={save}
      disabled={state === "saving"}
      className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)] disabled:opacity-40"
      title="Get emailed when a NEW hot/warm deal matches this search"
    >
      🔔 {state === "saving" ? "Saving…" : "Alert me"}
    </button>
  );
}

// Shimmer placeholder while leads load — same shape as the real card.
function CardSkeleton() {
  return (
    <div className="flex gap-3 rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-3">
      <div className="shrink-0 w-28 h-24 rounded-[var(--r2)] shimmer" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-1/3 rounded shimmer" />
        <div className="h-4 w-2/3 rounded shimmer" />
        <div className="h-3 w-1/2 rounded shimmer" />
        <div className="h-5 w-3/4 rounded shimmer mt-2" />
      </div>
    </div>
  );
}

function LeadCard({ lead, index = 0 }: { lead: Lead; index?: number }) {
  const color = TIER_COLOR[lead.tier] || "var(--blue)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.03 }}
      whileHover={{ y: -3 }}
    >
      <Link
        href={`/homeiq/leads/${encodeURIComponent(lead.id)}`}
        className="group relative flex gap-3 rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-3 transition-shadow hover:shadow-[var(--shadow)] hover:border-[var(--home-bd)]"
      >
        <QuickSave listingId={lead.id} />
        <div className="relative shrink-0 w-28 h-24 rounded-[var(--r2)] overflow-hidden bg-[var(--s2)]">
          {lead.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lead.image}
              alt={lead.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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
              style={{
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                color,
              }}
            >
              {lead.tier}
            </span>
            <span className="text-[11px] text-[var(--t4)] capitalize">
              {(lead.property_type || "").replace("_", " ")}
            </span>
            {lead.source && (
              <span className="text-[10px] font-semibold text-[var(--t4)] px-1.5 py-0.5 rounded-full bg-[var(--s2)] border border-[var(--b1)]">
                {sourceLabel(lead.source)}
              </span>
            )}
            {(lead.stack || 0) >= 2 && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{ color: "#fff", background: "var(--red)" }}
                title="Appears on multiple distress lists — high motivation"
              >
                📚 {lead.stack} lists
              </span>
            )}
            {/* Distress magnitudes (amount owed, foreclosure, below-market) — the PropStream-grade detail. */}
            {(lead.distress?.sheriffSale || lead.distress?.foreclosure) && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{ color: "#fff", background: "var(--red)" }}
              >
                ⚖️ Foreclosure
              </span>
            )}
            {lead.distress?.totalDue ? (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--s2)]"
                style={{
                  color: "var(--amber)",
                  border: "1px solid var(--amber)",
                }}
                title="Property-tax delinquency"
              >
                Owes ${Math.round(lead.distress.totalDue / 1000)}k
                {lead.distress.yearsOwed
                  ? ` · ${lead.distress.yearsOwed}y`
                  : ""}
              </span>
            ) : null}
            {lead.distress?.belowMarket && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--s2)]"
                style={{
                  color: "var(--green)",
                  border: "1px solid var(--green)",
                }}
              >
                ↓ Below market
              </span>
            )}
            {lead.distress?.violations ? (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--s2)]"
                style={{
                  color: "var(--amber)",
                  border: "1px solid var(--amber)",
                }}
              >
                {lead.distress.violations} violations
              </span>
            ) : null}
            {lead.status && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  color: statusColor(lead.status),
                  background: `${statusColor(lead.status)}1a`,
                }}
              >
                {lead.status}
              </span>
            )}
          </div>
          <div className="mt-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--t4)] mr-1.5">
              {housingPriceTerms(lead.source, !!lead.auction_end).priceLabel}
            </span>
            <span className="font-black text-[var(--t1)]">
              {lead.price ? `$${lead.price.toLocaleString()}` : "—"}
            </span>
            <span className="font-medium text-sm text-[var(--t3)]">
              {lead.city
                ? ` · ${lead.city}, ${lead.state || ""}`
                : lead.state
                  ? ` · ${lead.state}`
                  : ""}
            </span>
          </div>
          <h3 className="text-sm text-[var(--t2)] truncate">{lead.title}</h3>
          {/* Glance facts — the physical specs buyers scan first (beds/baths/sqft/$psf/days-on-market). */}
          {(lead.beds != null ||
            lead.baths != null ||
            lead.sqft != null ||
            lead.daysOnMarket != null) && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--t3)] font-semibold flex-wrap">
              {lead.beds != null && <span>{lead.beds} bd</span>}
              {lead.baths != null && <span>· {lead.baths} ba</span>}
              {lead.sqft != null && (
                <span>· {lead.sqft.toLocaleString()} sqft</span>
              )}
              {lead.pricePerSqft != null && (
                <span className="text-[var(--t4)]">
                  · ${lead.pricePerSqft}/sqft
                </span>
              )}
              {lead.year_built != null && (
                <span className="text-[var(--t4)]">
                  · built {lead.year_built}
                </span>
              )}
              {lead.daysOnMarket != null && lead.daysOnMarket >= 30 && (
                <span style={{ color: "var(--amber)" }}>
                  · {lead.daysOnMarket}d on market
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {(() => {
              const c = readHomeCondition({
                property_type: lead.property_type,
                status: lead.status,
                title: lead.title,
              });
              if (!c) return null;
              return (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${HOME_CONDITION_TIER_COLOR[c.tier]}1f`,
                    color: HOME_CONDITION_TIER_COLOR[c.tier],
                  }}
                >
                  {c.label}
                </span>
              );
            })()}
            {(lead.signals || []).slice(0, 1).map((s, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--s2)] text-[var(--t3)] border border-[var(--b1)]"
              >
                {s}
              </span>
            ))}
          </div>

          {/* Dual-lens deal strip — the two ways to make money, glanceable on every card. FLIP (70%-rule
            max offer + verdict) and HOLD (cap rate + monthly cashflow). Each lights up only when computable. */}
          {(lead.mao != null || lead.capRate != null) && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {lead.mao != null && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[var(--s2)] border"
                  style={{
                    borderColor:
                      VERDICT_COLOR[lead.verdict || ""] || "var(--b1)",
                    color: VERDICT_COLOR[lead.verdict || ""] || ACCENT,
                  }}
                  title="Flip — 70%-rule max allowable offer + verdict"
                >
                  🔨 {shortMoney(lead.mao)}
                  <span className="opacity-70 capitalize">{lead.verdict}</span>
                  {lead.equity != null &&
                    lead.equity > 0 &&
                    (lead.verdict === "strong" || lead.verdict === "fair") && (
                      <span className="opacity-90">
                        · {shortMoney(lead.equity)} equity
                      </span>
                    )}
                </span>
              )}
              {lead.capRate != null && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-[var(--s2)] border"
                  style={{
                    borderColor:
                      CASHFLOW_COLOR[lead.cashflowRating || ""] || "var(--b1)",
                    color: CASHFLOW_COLOR[lead.cashflowRating || ""] || ACCENT,
                  }}
                  title="Hold — rental cap rate + monthly cashflow (50% rule, all-in basis)"
                >
                  🏦 {lead.capRate}% cap
                  {lead.cashflowMo != null && (
                    <span className="opacity-90">
                      · {shortMoney(lead.cashflowMo)}/mo
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
