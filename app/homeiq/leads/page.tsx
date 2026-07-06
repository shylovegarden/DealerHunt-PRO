"use client";

import { useState, useMemo, useEffect, useRef, Suspense, memo } from "react";
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
import { usePreferences } from "@/hooks/usePreferences";
import { resolvePropertyImage } from "@/lib/housing/property-image";
import { MarketPicker } from "@/components/shared/MarketPicker";
import { RecentlyViewed } from "@/components/shared/RecentlyViewed";
import { CompareToggle, CompareBar } from "@/components/shared/CompareControls";
import { EdgeBanner } from "@/components/shared/EdgeBanner";

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
    "Owner Properties",
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
      l.ownerCount,
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
  ownerCount?: number;
  stack?: number;
  priceDrops?: number | null;
  prevPrice?: number | null;
  anomaly?: boolean;
  anomalyPct?: number;
  neighborhood?: string;
  flood?: { zone: string; high: boolean };
  lat?: number | null;
  lng?: number | null;
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
  arvConfidence?: "high" | "medium" | "low" | "none";
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
  // A deep-link `?state=` always wins; otherwise fall back to the user's saved default market (applied once
  // below). Effective scope = URL state OR saved pref — so you land on your market without re-picking, and
  // can still widen to Nearby / Nationwide whenever you want more.
  const urlState = (params.get("state") || "").toUpperCase();
  const [prefState, setPrefState] = useState("");
  const scopeState = urlState || prefState;
  const [scopeMode, setScopeMode] = useState<
    "state" | "nearby" | "national" | "hunt"
  >(urlState ? "state" : "national");
  const { prefs, save } = usePreferences();
  // The user's multi-state "hunt list" — the set of states they actively work (settings). Powers a "My
  // states" scope that queries all of them at once via the API's existing ?states= param.
  const huntStates = useMemo(
    () =>
      (prefs.homeiqStates || []).map((v) => v.toUpperCase()).filter(Boolean),
    [prefs.homeiqStates],
  );
  const prefsApplied = useRef(false);
  // Initialize filters from the URL so deep-links from the Market dashboard land pre-filtered.
  const [tier, setTier] = useState(params.get("tier") || "");
  const [type, setType] = useState(params.get("type") || "");
  const [source, setSource] = useState(params.get("source") || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [sort, setSort] = useState("score");
  const [maxPrice, setMaxPrice] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [hideInstitutional, setHideInstitutional] = useState(false);
  const [q, setQ] = useState(params.get("q") || ""); // pre-filled by the city/ZIP front-door search
  const [visible, setVisible] = useState(PAGE);
  // Mobile is list-OR-map (Zillow pattern), so the listings lead instead of a map shoving them down the
  // page; desktop always shows the split. Default to the list — that's what the user came for.
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  // Desktop layout: "split" = dense list beside the map; "grid" = full-width photo-forward gallery.
  const [gridView, setGridView] = useState(false);
  // Secondary filters (type/source/price/sort) collapse behind a "Filters" button on mobile so the bar
  // doesn't wrap into 4 cramped rows; always shown on desktop.
  const [showFilters, setShowFilters] = useState(false);

  // Apply the saved defaults ONCE, only for what the URL didn't already specify (so deep-links win and we
  // never fight the user after they've started filtering).
  useEffect(() => {
    if (prefsApplied.current || !Object.keys(prefs).length) return;
    prefsApplied.current = true;
    if (!urlState) {
      // A saved hunt list (2+ states) wins as the default view; else the single default market.
      if ((prefs.homeiqStates || []).length >= 2) {
        setScopeMode("hunt");
      } else if (prefs.homeiqState) {
        setPrefState(prefs.homeiqState.toUpperCase());
        setScopeMode("state");
      }
    }
    if (!params.get("tier") && prefs.homeiqTier) setTier(prefs.homeiqTier);
    if (!params.get("type") && prefs.homeiqType) setType(prefs.homeiqType);
    if (prefs.homeiqMaxPrice) setMaxPrice(prefs.homeiqMaxPrice);
    if (prefs.homeiqHideInstitutional) setHideInstitutional(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs]);

  // SERVER-SIDE SCOPE: fetch the current scope from the full 54k (your state / nearby / national top),
  // then filter/sort/search instantly client-side WITHIN that slice. Re-fetches when the scope changes.
  const fetchUrl = useMemo(() => {
    if (scopeMode === "hunt" && huntStates.length)
      return `/api/homeiq/leads?states=${huntStates.join(",")}`;
    if (!scopeState || scopeMode === "national") return "/api/homeiq/leads";
    if (scopeMode === "nearby")
      return `/api/homeiq/leads?states=${Array.from(nearbyStates(scopeState, 6)).join(",")}`;
    return `/api/homeiq/leads?state=${scopeState}`;
  }, [scopeState, scopeMode, huntStates]);
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
    if (scopeMode === "hunt" && huntStates.length) return new Set(huntStates);
    if (!scopeState || scopeMode === "national") return null;
    return scopeMode === "nearby"
      ? nearbyStates(scopeState, 6)
      : new Set([scopeState]);
  }, [scopeState, scopeMode, huntStates]);

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
    // Hide institutional / portfolio owners (>=5 properties) — they don't sell to wholesalers.
    if (hideInstitutional) r = r.filter((l) => (l.ownerCount || 0) < 5);
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
    hideInstitutional,
    q,
    sort,
  ]);

  // Reset the visible window whenever the result set changes.
  useEffect(
    () => setVisible(PAGE),
    [
      scopeSet,
      tier,
      type,
      source,
      category,
      maxPrice,
      minPrice,
      hideInstitutional,
      q,
      sort,
    ],
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
  // Map plots the FULL filtered set (not just the scrolled-in window) so it's a real search surface: filter
  // the list → every matching lead appears on the map, anywhere in scope. Clustering handles the volume;
  // cap at 3000 markers for perf.
  const filteredIds = new Set(leads.map((l) => l.id));
  const mapPoints = points
    .filter((p: any) => filteredIds.has(p.id))
    .slice(0, 3000);
  const nearbyCount = scopeState
    ? Object.keys(byState)
        .filter((s) => nearbyStates(scopeState, 6).has(s))
        .reduce((n, s) => n + byState[s], 0)
    : 0;

  // Active secondary-filter count for the mobile "Filters" badge.
  const activeFilters =
    [type, source, category].filter(Boolean).length +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (hideInstitutional ? 1 : 0);

  return (
    <div className="bg-transparent text-[var(--t1)]">
      <CompareBar kind="home" href="/homeiq/compare" accent="var(--home)" />
      {/* Your edge today — fresh distressed flow on the board right now. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <EdgeBanner kind="homes" />
      </div>
      {/* Location scope — progressive: your state → nearby → nationwide */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 flex items-center justify-between gap-2 flex-wrap">
        {scopeState || huntStates.length ? (
          <div className="flex items-center gap-1.5 p-1 rounded-[var(--r3)] bg-[var(--s2)] border border-[var(--b1)] text-xs font-bold">
            {(
              [
                ...(huntStates.length
                  ? [["hunt", `⭐ My states (${huntStates.length})`]]
                  : []),
                ...(scopeState
                  ? [
                      ["state", `📍 ${ST[scopeState]?.[0] || scopeState}`],
                      [
                        "nearby",
                        `Nearby${nearbyCount ? ` (${nearbyCount})` : ""}`,
                      ],
                    ]
                  : []),
                ["national", "Nationwide"],
              ] as ["state" | "nearby" | "national" | "hunt", string][]
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
            className="hidden sm:inline text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
          >
            📋 Pipeline
          </Link>
          <Link
            href="/homeiq/states"
            className="hidden sm:inline text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
          >
            🗺️ Browse all states
          </Link>
        </div>
      </div>

      {/* Guided first-run: no market chosen → pick it here and leads personalize instantly. */}
      {!scopeState && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
          <MarketPicker
            vertical="homeiq"
            accent="var(--home)"
            onPick={(st) => {
              setPrefState(st.toUpperCase());
              setScopeMode("state");
            }}
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
        <RecentlyViewed kind="home" accent="var(--home)" />
      </div>

      {/* Filter bar — search + tier always visible; the rest collapses behind "Filters" on mobile. */}
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
        {/* Mobile-only Filters toggle with active-count badge. */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--r3)] bg-[var(--s0)] border border-[var(--b1)] text-xs font-bold text-[var(--t2)]"
        >
          ⚙ Filters
          {activeFilters > 0 && (
            <span
              className="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-black text-black"
              style={{ background: ACCENT }}
            >
              {activeFilters}
            </span>
          )}
        </button>
        {/* Secondary filters — hidden on mobile until toggled, always inline on md+. */}
        <div
          className={`${showFilters ? "flex" : "hidden"} md:flex items-center gap-2 flex-wrap w-full md:w-auto`}
        >
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
              onBlur={() => save({ homeiqMaxPrice: maxPrice || 0 })}
              placeholder="Max"
              className="w-16 bg-transparent focus:outline-none"
              aria-label="Max price"
            />
          </div>
          <Select value={sort} onChange={setSort} options={SORTS} />
        </div>
      </div>

      {/* Quick Lists — PropStream-style lead categories. One scrolling row on mobile, wraps on desktop. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 flex items-center gap-1.5 overflow-x-auto md:flex-wrap scrollbar-hide">
        <button
          onClick={() => setCategory("")}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap"
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
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-black transition-colors whitespace-nowrap"
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
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap"
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
        {/* Hide institutional / portfolio owners — one tap removes the un-sellable inventory (they don't
            sell to wholesalers). Only shown when there are any in the current scope. */}
        {(() => {
          const inst = all.filter((l) => (l.ownerCount || 0) >= 5).length;
          if (inst === 0) return null;
          return (
            <button
              onClick={() =>
                setHideInstitutional((v) => {
                  save({ homeiqHideInstitutional: !v });
                  return !v;
                })
              }
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap"
              style={{
                background: hideInstitutional ? "var(--t1)" : "var(--s2)",
                color: hideInstitutional ? "var(--s0)" : "var(--t3)",
                border: "1px solid var(--b1)",
              }}
              title="Hide portfolio / institutional landlords (5+ properties) — they don't sell to wholesalers"
            >
              {hideInstitutional
                ? "🏢 Institutional hidden"
                : "🏢 Hide institutional"}{" "}
              <span style={{ opacity: 0.6 }}>{inst.toLocaleString()}</span>
            </button>
          );
        })()}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--t4)]">
          {leads.length.toLocaleString()} leads{scopeSet ? "" : " (top)"} ·
          showing {shown.length}
        </span>
        <div className="flex items-center gap-2">
          {/* Desktop split/grid toggle — dense list+map vs a full-width photo gallery. */}
          <div className="hidden lg:flex items-center p-0.5 rounded-full bg-[var(--s2)] border border-[var(--b1)] text-xs font-bold">
            {(["split", "grid"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setGridView(v === "grid")}
                className="px-3 py-1 rounded-full capitalize transition-colors"
                style={{
                  background:
                    (v === "grid") === gridView ? "var(--home)" : "transparent",
                  color: (v === "grid") === gridView ? "#04201d" : "var(--t3)",
                }}
              >
                {v === "split" ? "☰ Split" : "▦ Grid"}
              </button>
            ))}
          </div>
          {/* Mobile list/map toggle — desktop shows both, so this is mobile-only. */}
          <div className="lg:hidden flex items-center p-0.5 rounded-full bg-[var(--s2)] border border-[var(--b1)] text-xs font-bold">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMobileView(v)}
                className="px-3 py-1 rounded-full capitalize transition-colors"
                style={{
                  background: mobileView === v ? "var(--home)" : "transparent",
                  color: mobileView === v ? "#04201d" : "var(--t3)",
                }}
              >
                {v === "list" ? "☰ List" : "🗺 Map"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`max-w-7xl mx-auto px-4 sm:px-6 py-4 grid gap-5 ${
          gridView ? "" : "lg:grid-cols-[1fr_minmax(320px,38%)]"
        }`}
      >
        <div
          className={`min-w-0 ${mobileView === "map" ? "hidden lg:block" : ""}`}
        >
          {/* Split: dense list beside the map. Grid: a full-width photo-forward gallery (more columns). */}
          <div
            className={`grid gap-3 ${
              gridView
                ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
            }`}
          >
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            {shown.map((l, i) =>
              gridView ? (
                <PhotoLeadCard key={l.id} lead={l} index={i} />
              ) : (
                <LeadCard key={l.id} lead={l} index={i} />
              ),
            )}
          </div>
          {!isLoading && leads.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-[var(--t2)] font-bold">No leads match</p>
              <p className="text-[var(--t4)] text-sm mt-1">
                Try widening the scope or clearing a filter.
              </p>
            </div>
          )}
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
        <div
          className={`min-w-0 lg:sticky lg:top-5 h-[70vh] lg:h-[78vh] ${
            gridView ? "hidden" : mobileView === "list" ? "hidden lg:block" : ""
          }`}
        >
          <DealerMap points={mapPoints} />
        </div>
      </div>
    </div>
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
              background: "var(--s2)",
              borderColor: "var(--b3)",
              color: "var(--t2)",
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
          description: "New hot/warm matches will show up in your Alerts.",
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
      <div className="shrink-0 w-36 h-28 sm:w-44 sm:h-32 rounded-[var(--r2)] shimmer" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-1/3 rounded shimmer" />
        <div className="h-4 w-2/3 rounded shimmer" />
        <div className="h-3 w-1/2 rounded shimmer" />
        <div className="h-5 w-3/4 rounded shimmer mt-2" />
      </div>
    </div>
  );
}

// The homes analogue of the cars forecast chip: a seller-MOTIVATION read. Off-market distress leads don't
// have a market-velocity "time to sell" — the forward-looking signal is how motivated the owner is (imminent
// foreclosure, escalating tax debt, a price cut on a stale listing). One clear "should I move on this" headline.
function homeUrgency(lead: Lead): { label: string; color: string } | null {
  const d = lead.distress;
  if (d?.foreclosure || d?.sheriffSale)
    return { label: "🔥 Act now · foreclosure", color: "var(--red)" };
  if (d?.totalDue && (d.yearsOwed ?? 0) >= 2)
    return { label: "🔥 Act now · tax debt", color: "var(--red)" };
  if ((lead.priceDrops || 0) > 0 && (lead.daysOnMarket ?? 0) > 60)
    return { label: "⚡ Motivated · price cut", color: "var(--amber)" };
  if (d?.outOfState || d?.belowMarket)
    return { label: "⚡ Motivated seller", color: "var(--amber)" };
  return null;
}

// Photo-forward grid card — the aerial/photo is the HERO (4:3), with score + save overlaid and the
// price/address on a scrim. This is the "premium gallery" view; the horizontal LeadCard is the dense list.
const PhotoLeadCard = memo(function PhotoLeadCard({
  lead,
  index = 0,
}: {
  lead: Lead;
  index?: number;
}) {
  const color = TIER_COLOR[lead.tier] || "var(--blue)";
  const img = resolvePropertyImage(lead);
  const topSignal =
    lead.distress?.foreclosure || lead.distress?.sheriffSale
      ? "⚖️ Foreclosure"
      : lead.distress?.totalDue
        ? `Owes $${Math.round(lead.distress.totalDue / 1000)}k`
        : lead.anomaly
          ? `🎯 ${lead.anomalyPct}% below`
          : (lead.priceDrops || 0) > 0
            ? "↓ Price cut"
            : lead.distress?.belowMarket
              ? "↓ Below market"
              : lead.distress?.violations
                ? `${lead.distress.violations} violations`
                : null;
  const urgency = homeUrgency(lead);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.03 }}
      whileHover={{ y: -3 }}
    >
      <Link
        href={`/homeiq/leads/${encodeURIComponent(lead.id)}`}
        className="group relative block overflow-hidden rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] transition-shadow hover:shadow-[var(--shadow)] hover:border-[var(--home-bd)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--s2)]">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.url}
              alt={lead.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="grid h-full w-full place-items-center"
              style={{
                background: "linear-gradient(135deg, var(--s2), var(--s0))",
              }}
            >
              <span className="text-3xl opacity-50" aria-hidden>
                🏡
              </span>
            </div>
          )}
          {/* bottom scrim for legible price/address over any image */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.82), transparent)",
            }}
          />
          <span
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[12px] font-black text-white"
            style={{ background: color }}
          >
            {lead.score}
          </span>
          <div className="absolute right-1.5 top-1.5">
            <QuickSave listingId={lead.id} />
          </div>
          {img && img.kind !== "listing" && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1 py-0.5 text-[9px] font-bold text-white">
              {img.kind === "aerial" ? "🛰 Aerial" : "🗺 Map"}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-3">
            {/* Motivation forecast — the homes twin of the cars 'Act now' chip. */}
            {urgency && (
              <span
                className="mb-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                style={{ background: urgency.color }}
              >
                {urgency.label}
              </span>
            )}
            <div className="text-lg font-black leading-tight text-white drop-shadow">
              {lead.price ? `$${lead.price.toLocaleString()}` : "Off-market"}
            </div>
            <div className="truncate text-xs font-semibold text-white/90 drop-shadow">
              {lead.title}
            </div>
            <div className="truncate text-[11px] text-white/65">
              {[lead.city, lead.state].filter(Boolean).join(", ")}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color }}
          >
            {lead.tier}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Cross-source: appears on N distress lists — the homes 'N sources' signal. */}
            {(lead.stack || 0) >= 2 && (
              <span
                className="text-[10px] font-black"
                style={{ color: "var(--red)" }}
                title="Appears on multiple distress lists — high motivation"
              >
                📚 {lead.stack}
              </span>
            )}
            {topSignal && (
              <span
                className="truncate text-[11px] font-black"
                style={{ color: "var(--amber)" }}
              >
                {topSignal}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
});

// Memoized so typing in search, infinite-scroll appends, and filter toggles don't re-render every
// already-rendered card (each card carries framer-motion + an image) — keeps scrolling/typing at high FPS.
const LeadCard = memo(function LeadCard({
  lead,
  index = 0,
}: {
  lead: Lead;
  index?: number;
}) {
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
        <div className="absolute top-1.5 right-10 z-[1]">
          <CompareToggle id={lead.id} kind="home" accent="var(--home)" />
        </div>
        <div className="relative shrink-0 w-36 h-28 sm:w-44 sm:h-32 rounded-[var(--r2)] overflow-hidden bg-[var(--s2)]">
          {(() => {
            // Photo fallback chain (listing → aerial → street map), badged honestly by provenance.
            const img = resolvePropertyImage(lead);
            return img ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={lead.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                {img.kind !== "listing" && (
                  <span className="absolute bottom-1 left-1 text-[9px] font-bold px-1 py-0.5 rounded bg-black/60 text-white">
                    {img.kind === "aerial" ? "🛰 Aerial" : "🗺 Map"}
                  </span>
                )}
              </>
            ) : (
              <div
                className="w-full h-full grid place-items-center"
                style={{
                  background:
                    "linear-gradient(135deg, var(--s2), var(--s1) 60%, var(--s0))",
                }}
              >
                <div className="flex flex-col items-center gap-1 text-[var(--t4)]">
                  <span className="text-2xl opacity-50" aria-hidden>
                    🏡
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider">
                    Off-market
                  </span>
                </div>
              </div>
            );
          })()}
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
            {/* FEMA flood risk — a Special Flood Hazard Area (mandatory insurance, worse for a hold). */}
            {lead.flood?.high && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{
                  color: "var(--blue)",
                  border: "1px solid var(--blue)",
                }}
                title={`FEMA flood zone ${lead.flood.zone} — mandatory flood insurance`}
              >
                🌊 Flood {lead.flood.zone}
              </span>
            )}
            {/* Census neighborhood trajectory — rising = appreciating area. */}
            {lead.neighborhood === "rising" && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{
                  color: "var(--green)",
                  border: "1px solid var(--green)",
                }}
                title="Census: incomes/population outpacing the national median"
              >
                🌆 Rising area
              </span>
            )}
            {/* Statistical underpricing flag (vs same-type $/sqft comps). */}
            {lead.anomaly && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{
                  color: "var(--green)",
                  border: "1px solid var(--green)",
                }}
                title="Priced below comparable listings in this market"
              >
                🎯 {lead.anomalyPct}% below comps
              </span>
            )}
            {/* Self-detected price cut — seller softening. */}
            {(lead.priceDrops || 0) > 0 &&
              (lead.prevPrice || 0) > (lead.price || 0) && (
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{
                    color: "var(--red)",
                    border: "1px solid var(--red)",
                  }}
                  title={`Was $${(lead.prevPrice || 0).toLocaleString()}`}
                >
                  ↓ Cut{lead.priceDrops! > 1 ? ` ${lead.priceDrops}×` : ""}
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
          {/* Owner of record — the thing that distinguishes otherwise-identical parcels at one building (e.g. a
              condo complex of absentee owners) and the direct-mail target itself. */}
          {lead.owner && (
            <p className="text-[11px] text-[var(--t3)] truncate mt-0.5">
              👤 <span className="font-semibold">{lead.owner}</span>
              {lead.distress?.outOfState && lead.distress?.ownerState && (
                <span className="text-[var(--amber)] font-bold">
                  {" "}
                  · absentee {lead.distress.ownerState}
                </span>
              )}
              {lead.ownerMailing && (
                <span className="text-[var(--green)]"> · 📮 mail-ready</span>
              )}
              {(lead.ownerCount || 0) >= 5 && (
                <span
                  className="text-[var(--t1)] font-bold"
                  title="This owner holds many properties — a portfolio / institutional landlord, usually not a motivated individual seller"
                >
                  {" "}
                  · 🏢 {lead.ownerCount!.toLocaleString()} properties
                </span>
              )}
            </p>
          )}
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
              {lead.mao != null &&
                lead.arvConfidence &&
                lead.arvConfidence !== "none" && (
                  <span
                    className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--s2)]"
                    style={{
                      color:
                        lead.arvConfidence === "low"
                          ? "var(--t4)"
                          : "var(--green)",
                    }}
                    title={
                      lead.arvConfidence === "low"
                        ? "ARV from a coarse regional estimate — verify before offering"
                        : "ARV backed by real sold comps"
                    }
                  >
                    {lead.arvConfidence === "low" ? "~est" : "✓ comps"}
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
});
