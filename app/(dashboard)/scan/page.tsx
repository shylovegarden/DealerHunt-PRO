"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useViewTransition } from "@/hooks/useViewTransition";
import useSWR from "swr";
import { Mono } from "@/components/shared/Mono";
import { Ico } from "@/components/shared/Ico";
import { DealCard, DealCardSkeleton } from "@/components/shared/DealCard";
import { ErrorState as SharedErrorState } from "@/components/shared/ErrorState";
import { ALL_VEHICLE_SOURCES } from "@/lib/utils/sources";
import { cn } from "@/lib/utils";
import { Deal } from "@/lib/data/deals-service";
import { US_STATES } from "@/lib/utils/titleRules";
import { createClientComponentClient } from "@/lib/supabase";
import { useDealerId } from "@/hooks/useDealerId";
import { fetcher } from "@/lib/swr-config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScanResult {
  id: string;
  source: string;
  year: number;
  make: string;
  model: string;
  askPrice: number;
  mmrValue: number;
  profitEstimate: number;
  profitScore: number;
  locationCity?: string;
  locationState?: string;
  mileage?: number;
  condition?: string;
  damageType?: string;
  dealVerdict?: "go" | "hold" | "pass";
  recommendedMaxBid?: number;
  sellEstimate?: number;
  repairEstimate: number;
  auctionEnds: string;
}

function mapDealToResult(deal: Deal): ScanResult {
  return {
    id: deal.id,
    source: deal.source,
    year: deal.year ?? 0,
    make: deal.make || "",
    model: deal.model || "",
    askPrice: deal.askPrice ?? 0,
    mmrValue: deal.mmrValue ?? 0,
    profitEstimate: deal.profitEstimate ?? 0,
    profitScore: deal.profitScore ?? 50,
    locationCity: deal.locationCity,
    locationState: deal.locationState,
    mileage: deal.mileage,
    condition: deal.condition,
    damageType: deal.damageType,
    dealVerdict: deal.dealVerdict,
    recommendedMaxBid: deal.recommendedMaxBid,
    sellEstimate: deal.sellEstimate,
    repairEstimate: (deal as any).repair_estimate ?? 0,
    auctionEnds: deal.auctionEndAt
      ? new Date(deal.auctionEndAt).toLocaleDateString()
      : "Active",
  };
}

// ── Toast notification ────────────────────────────────────────────────────────

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "info" | "error";
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 rounded-[var(--r3)] px-4 py-3 border shadow-lg"
          style={{
            background:
              t.type === "success"
                ? "rgba(5,150,105,0.10)"
                : t.type === "error"
                  ? "rgba(220,38,38,0.10)"
                  : "rgba(255,56,92,0.08)",
            borderColor:
              t.type === "success"
                ? "rgba(5,150,105,0.25)"
                : t.type === "error"
                  ? "rgba(220,38,38,0.25)"
                  : "rgba(255,56,92,0.25)",
            color:
              t.type === "success"
                ? "var(--green)"
                : t.type === "error"
                  ? "var(--red)"
                  : "var(--amber)",
            animation: "fadeUp 200ms cubic-bezier(.16,1,.3,1)",
            backdropFilter: "blur(12px)",
          }}
        >
          <span className="text-sm font-semibold">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Status strip ──────────────────────────────────────────────────────────────

function StatusStrip({
  loading,
  error,
  total,
  results,
  lastScan,
}: {
  loading: boolean;
  error: string | null;
  total: number;
  results: ScanResult[];
  lastScan: Date | null;
}) {
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    results.forEach((r) => {
      counts[r.source] = (counts[r.source] || 0) + 1;
    });
    return counts;
  }, [results]);

  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const lastScanText = lastScan
    ? lastScan.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "never";

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 rounded-[var(--r3)] font-mono text-[11px] overflow-x-auto"
      style={{ background: "var(--s1)", border: "1px solid var(--b1)" }}
    >
      {/* Status dot */}
      <span className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn(
            "w-2 h-2 rounded-full inline-block",
            loading ? "animate-pulse" : "",
          )}
          style={{ background: error ? "var(--red)" : "var(--green)" }}
        />
        <span style={{ color: error ? "var(--red)" : "var(--green)" }}>
          {error ? "[ERR]" : "[OK]"}
        </span>
        <span className="text-[var(--t4)] font-semibold">Connected</span>
      </span>

      <span className="text-[var(--b3)] hidden sm:inline">·</span>

      <span className="text-[var(--t2)] shrink-0">
        <span style={{ color: "var(--amber)" }}>{total}</span> active deals
      </span>

      <span className="text-[var(--b3)] hidden sm:inline">·</span>

      <span className="text-[var(--t4)] shrink-0">
        Last scan: <span className="text-[var(--t2)]">{lastScanText}</span>
      </span>

      {topSources.length > 0 && (
        <>
          <span className="text-[var(--b3)] hidden md:inline">·</span>
          <span className="text-[var(--t4)] hidden md:inline">
            {topSources.map(([src, n], i) => (
              <span key={src}>
                {i > 0 && <span className="mx-1.5 opacity-30">·</span>}
                <span className="text-[var(--t2)]">
                  {src.charAt(0).toUpperCase() + src.slice(1)}
                </span>
                <span className="text-[var(--t4)">: {n}</span>
              </span>
            ))}
          </span>
        </>
      )}

      {loading && (
        <span className="text-[var(--amber)] animate-pulse shrink-0 ml-auto">
          Fetching...
        </span>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-2xl"
      style={{ border: "2px dashed var(--b2)", background: "var(--s0)" }}
    >
      {/* Animated radar pulse */}
      <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
        {/* Pulse rings */}
        <span
          className="absolute inset-0 rounded-full border-2"
          style={{
            borderColor: "rgba(255,56,92,0.20)",
            animation: "pulse-ring 2s ease-out infinite",
          }}
        />
        <span
          className="absolute inset-0 rounded-full border-2 scale-75"
          style={{
            borderColor: "rgba(255,56,92,0.30)",
            animation: "pulse-ring 2s ease-out infinite 0.5s",
          }}
        />
        <span
          className="absolute inset-0 rounded-full border-2 scale-50"
          style={{
            borderColor: "rgba(255,56,92,0.40)",
            animation: "pulse-ring 2s ease-out infinite 1s",
          }}
        />
        {/* Center icon */}
        <div
          className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "var(--clo)", border: "2px solid var(--cbd)" }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--amber)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="2" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-[var(--t1)] mb-3">
        Scrapers Warming Up
      </h2>
      <p className="text-[var(--t3)] max-w-sm mb-2 leading-relaxed">
        First results appear within{" "}
        <strong className="text-[var(--t1)]">5 minutes</strong> of starting the
        worker. The deal pipeline is initializing.
      </p>
      <p className="text-[var(--t4)] text-sm mb-8">
        The database is empty — scrapers haven't run yet.
      </p>

      {/* Command block */}
      <div
        className="w-full max-w-sm rounded-[var(--r3)] p-4 mb-6 text-left"
        style={{ background: "var(--s2)", border: "1px solid var(--b2)" }}
      >
        <p className="text-[10px] uppercase tracking-widest text-[var(--t4)] font-bold mb-2">
          Start the worker
        </p>
        <div
          className="flex items-center justify-between gap-3 rounded-[var(--r2)] px-3 py-2.5"
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Mono className="text-sm text-[#4ADE80]">npm run worker</Mono>
          <button
            onClick={() =>
              navigator.clipboard?.writeText("npm run worker").catch(() => {})
            }
            className="text-[var(--t4)] hover:text-white transition-colors shrink-0"
            title="Copy"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
      </div>

      <button
        onClick={onRetry}
        className="flex items-center gap-2 text-sm font-bold rounded-xl px-5 py-2.5 transition-all text-white border-none"
        style={{ background: "var(--grad)" }}
      >
        <Ico name="refresh" size={16} />
        Refresh Now
      </button>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(1.5);  opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Error state (uses shared ErrorState component) ────────────────────────────

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <SharedErrorState
      title="Scan Failed"
      message={message}
      onRetry={onRetry}
      retryLabel="Retry"
    />
  );
}

// ── Filter select ─────────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm text-[var(--t1)] rounded-[var(--r2)] px-3 py-2 outline-none transition-all"
      style={{
        background: "var(--s0)",
        border: "1px solid var(--b2)",
        fontFamily: "var(--fn)",
      }}
      aria-label={label}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

let _toastId = 0;

export default function ScanPage() {
  const { transitionTo } = useViewTransition();
  const { dealerId, loading: dealerLoading } = useDealerId();

  // Search
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState("all");
  const [titleType, setTitleType] = useState("all");
  const [minProfit, setMinProfit] = useState("any");
  const [state, setState] = useState("all");
  const [make, setMake] = useState("all");
  const [maxPrice, setMaxPrice] = useState("any");
  const [minYear, setMinYear] = useState("any");
  const [maxMileage, setMaxMileage] = useState("any");
  const [sort, setSort] = useState("profit");

  // Dynamic facets — only offer makes that have live inventory (in the selected state).
  const { data: facets } = useSWR(
    `/api/scan/facets${state !== "all" ? `?state=${state}` : ""}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const makeOptions = useMemo(() => {
    const opts = [{ value: "all", label: "Make: All" }];
    for (const m of facets?.makes ?? [])
      opts.push({ value: m.make, label: `${m.make} (${m.count})` });
    return opts;
  }, [facets]);

  // Build SWR key from filters
  const swrKey = useMemo(() => {
    if (dealerLoading || !dealerId) return null;
    const params = new URLSearchParams({ sort });
    if (search) params.set("q", search);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (titleType !== "all") params.set("titleType", titleType);
    if (state !== "all") params.set("state", state);
    if (make !== "all") params.set("make", make);
    if (minProfit !== "any")
      params.set("minProfit", minProfit.replace("k", "000"));
    if (maxPrice !== "any")
      params.set("maxPrice", maxPrice.replace("k", "000"));
    if (minYear !== "any") params.set("minYear", minYear);
    if (maxMileage !== "any")
      params.set("maxMileage", maxMileage.replace("k", "000"));
    return `/api/scan?${params.toString()}`;
  }, [
    dealerId,
    dealerLoading,
    search,
    sourceFilter,
    titleType,
    state,
    make,
    minProfit,
    maxPrice,
    minYear,
    maxMileage,
    sort,
  ]);

  // Use SWR for data fetching
  const {
    data: swrData,
    error: swrError,
    isLoading: swrLoading,
    mutate,
  } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
    onSuccess: (data) => {
      // Cache for offline fallback
      if (swrKey) {
        try {
          localStorage.setItem(
            `dhp-scan-${swrKey}`,
            JSON.stringify({
              results: data.vehicles || [],
              total: data.total || 0,
              ts: Date.now(),
            }),
          );
        } catch {}
      }
    },
    onError: () => {
      // Try offline cache on error
      if (swrKey) {
        try {
          const cached = localStorage.getItem(`dhp-scan-${swrKey}`);
          if (cached) {
            const { results: r, total: t } = JSON.parse(cached);
            mutate({ vehicles: r, total: t }, false);
            addToast("Running offline — showing cached results", "info");
          }
        } catch {}
      }
    },
  });

  // Derive state from SWR
  const results = useMemo(
    () => (swrData?.vehicles || []).map(mapDealToResult),
    [swrData],
  );
  const total = swrData?.total || 0;
  const loading = dealerLoading || swrLoading;
  const error =
    !dealerId && !dealerLoading
      ? "Please sign in to view scan results."
      : swrError?.message || swrData?.error || null;
  const [lastScan, setLastScan] = useState<Date | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastItem["type"] = "success") => {
      const id = ++_toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        4000,
      );
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Debounce search input → set search state after 300ms idle
  const handleSearchInput = useCallback((val: string) => {
    setSearchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(val), 300);
  }, []);

  // Update last scan time when data changes
  useEffect(() => {
    if (swrData && !swrLoading) {
      setLastScan(new Date());
    }
  }, [swrData, swrLoading]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClientComponentClient();
    const channel = supabase
      .channel("scan-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deals" },
        (payload) => {
          const d = payload.new;
          if (state !== "all" && d.location_state !== state) return;
          if (sourceFilter !== "all" && d.source !== sourceFilter) return;

          // Build a row in the SAME (camelCase, Deal-like) shape the rest of the
          // `vehicles` array holds — i.e. the shape `normalizeRow()` produces on the
          // server — so that `mapDealToResult` reads it correctly. Pushing the raw
          // snake_case `payload.new` here would surface as a $0 / score-50 card.
          const newVehicle = {
            id: d.id,
            source: d.source || "unknown",
            year: d.year ?? undefined,
            make: d.make || "",
            model: d.model || "",
            askPrice: Number(d.ask_price ?? 0),
            mmrValue: Number(d.mmr_value ?? 0),
            profitEstimate: Number(d.profit_estimate ?? 0),
            profitScore:
              d.profit_score != null ? Number(d.profit_score) : undefined,
            locationCity: d.location_city || undefined,
            locationState: d.location_state || undefined,
            mileage: d.mileage ?? undefined,
            condition: d.condition || "",
            damageType: d.damage_type || undefined,
            dealVerdict: d.deal_verdict || undefined,
            recommendedMaxBid:
              d.recommended_max_bid != null
                ? Number(d.recommended_max_bid)
                : undefined,
            sellEstimate:
              d.sell_estimate != null ? Number(d.sell_estimate) : undefined,
            true_net_profit:
              d.true_net_profit != null ? Number(d.true_net_profit) : undefined,
            repair_estimate:
              d.repair_estimate != null ? Number(d.repair_estimate) : undefined,
            auctionEndAt: d.auction_end ? new Date(d.auction_end) : undefined,
          };

          // Optimistically add to SWR cache (same shape as other `vehicles` entries)
          mutate((current: any) => {
            const vehicles = current?.vehicles || [];
            if (vehicles.some((x: any) => x.id === d.id)) return current;
            return {
              vehicles: [newVehicle, ...vehicles],
              total: (current?.total || 0) + 1,
            };
          }, false);
          addToast(
            `+1 new deal found · ${newVehicle.year ?? ""} ${newVehicle.make} ${newVehicle.model}`,
            "success",
          );
        },
      )
      // Re-score / price-drop updates: merge the changed fields into the row already on screen,
      // so a verdict flip or a price drop shows without a refetch.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deals" },
        (payload) => {
          const d = payload.new;
          mutate((current: any) => {
            const vehicles = current?.vehicles || [];
            const idx = vehicles.findIndex((x: any) => x.id === d.id);
            if (idx === -1) return current;
            const updated = [...vehicles];
            updated[idx] = {
              ...updated[idx],
              askPrice: Number(d.ask_price ?? updated[idx].askPrice),
              profitScore:
                d.profit_score != null
                  ? Number(d.profit_score)
                  : updated[idx].profitScore,
              dealVerdict: d.deal_verdict ?? updated[idx].dealVerdict,
              recommendedMaxBid:
                d.recommended_max_bid != null
                  ? Number(d.recommended_max_bid)
                  : updated[idx].recommendedMaxBid,
              sellEstimate:
                d.sell_estimate != null
                  ? Number(d.sell_estimate)
                  : updated[idx].sellEstimate,
              true_net_profit:
                d.true_net_profit != null
                  ? Number(d.true_net_profit)
                  : updated[idx].true_net_profit,
            };
            return { ...current, vehicles: updated };
          }, false);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state, sourceFilter, sort, addToast, mutate]);

  // Client-side filtering + sorting with useMemo (instant, no re-fetch).
  // The API ignores `sort`, so the sort control is honored here.
  const filteredResults = useMemo(() => {
    let list = results;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r: ScanResult) =>
        `${r.year} ${r.make} ${r.model} ${r.locationCity ?? ""} ${r.locationState ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    const sorted = [...list];
    if (sort === "score") {
      sorted.sort((a, b) => (b.profitScore ?? 0) - (a.profitScore ?? 0));
    } else if (sort === "price") {
      sorted.sort((a, b) => (a.askPrice ?? 0) - (b.askPrice ?? 0));
    } else {
      // default: profit (descending)
      sorted.sort((a, b) => (b.profitEstimate ?? 0) - (a.profitEstimate ?? 0));
    }
    return sorted;
  }, [results, search, sort]);

  // Source options for filter
  const sourceOptions = useMemo(() => {
    const opts = [{ value: "all", label: "Source: All" }];
    ALL_VEHICLE_SOURCES.slice(0, 20).forEach((s) =>
      opts.push({ value: s.id, label: s.name }),
    );
    return opts;
  }, []);

  const stateOptions = useMemo(() => {
    const opts = [{ value: "all", label: "State: All" }];
    US_STATES.forEach((s) => opts.push({ value: s, label: s }));
    return opts;
  }, []);

  return (
    <div
      className="max-w-7xl mx-auto px-4 space-y-5 pb-24"
      style={{ animation: "fadeUp 200ms cubic-bezier(.16,1,.3,1)" }}
    >
      {/* ── Search bar ── */}
      <div className="glass-panel p-4 flex flex-col sm:flex-row gap-3 items-center sticky top-4 z-20">
        <div className="relative flex-1 w-full">
          <Ico
            name="search"
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--t4)] pointer-events-none"
          />
          <input
            type="text"
            className="w-full rounded-[var(--r3)] py-3.5 pl-11 pr-5 text-[var(--t1)] text-base outline-none transition-all"
            style={{
              background: "var(--s1)",
              border: "1.5px solid var(--b1)",
            }}
            placeholder='Search make, model, city… e.g. "F-150 Dallas" or "Tesla salvage"'
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--amber)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--b1)";
            }}
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput("");
                setSearch("");
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--t4)] hover:text-[var(--t1)] transition-colors"
              aria-label="Clear search"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => mutate()}
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 font-bold text-white rounded-xl py-3.5 px-7 transition-all disabled:opacity-50 border-none"
          style={{ background: "var(--grad)" }}
        >
          {loading ? (
            <>
              <span
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                style={{ animation: "spin 700ms linear infinite" }}
              />
              Scanning…
            </>
          ) : (
            <>
              <Ico name="scan" size={16} />
              Scan Market
            </>
          )}
        </button>
      </div>

      {/* ── Status strip ── */}
      <StatusStrip
        loading={loading}
        error={error}
        total={total}
        results={results}
        lastScan={lastScan}
      />

      {/* ── Filter bar ── */}
      <div className="glass-panel px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs text-[var(--t4)] font-semibold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <Ico name="filter" size={13} />
          Filters
        </span>

        <div className="flex flex-wrap gap-2 flex-1">
          <FilterSelect
            label="Source"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={sourceOptions}
          />
          <FilterSelect
            label="Title Type"
            value={titleType}
            onChange={setTitleType}
            options={[
              { value: "all", label: "Title: All" },
              { value: "clean", label: "Clean Title" },
              { value: "salvage", label: "Salvage Title" },
              { value: "rebuilt", label: "Rebuilt Title" },
            ]}
          />
          <FilterSelect
            label="Min Profit"
            value={minProfit}
            onChange={setMinProfit}
            options={[
              { value: "any", label: "Profit: Any" },
              { value: "1k", label: "Min $1,000" },
              { value: "2k", label: "Min $2,000" },
              { value: "3k", label: "Min $3,000" },
              { value: "5k", label: "Min $5,000" },
            ]}
          />
          <FilterSelect
            label="Max Price"
            value={maxPrice}
            onChange={setMaxPrice}
            options={[
              { value: "any", label: "Price: Any" },
              { value: "5k", label: "Under $5,000" },
              { value: "10k", label: "Under $10,000" },
              { value: "20k", label: "Under $20,000" },
              { value: "35k", label: "Under $35,000" },
              { value: "50k", label: "Under $50,000" },
            ]}
          />
          <FilterSelect
            label="Year From"
            value={minYear}
            onChange={setMinYear}
            options={[
              { value: "any", label: "Year: Any" },
              { value: "2000", label: "2000 +" },
              { value: "2010", label: "2010 +" },
              { value: "2015", label: "2015 +" },
              { value: "2018", label: "2018 +" },
              { value: "2021", label: "2021 +" },
            ]}
          />
          <FilterSelect
            label="Max Miles"
            value={maxMileage}
            onChange={setMaxMileage}
            options={[
              { value: "any", label: "Miles: Any" },
              { value: "50k", label: "Under 50k" },
              { value: "100k", label: "Under 100k" },
              { value: "150k", label: "Under 150k" },
            ]}
          />
          <FilterSelect
            label="State"
            value={state}
            onChange={setState}
            options={stateOptions}
          />
          <FilterSelect
            label="Make"
            value={make}
            onChange={setMake}
            options={makeOptions}
          />
          <FilterSelect
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "profit", label: "Sort: Profit ↓" },
              { value: "score", label: "Sort: Score ↓" },
              { value: "price", label: "Sort: Price ↑" },
            ]}
          />
        </div>

        {/* Results count */}
        {!loading && (
          <span className="text-xs text-[var(--t3)] ml-auto shrink-0 font-mono">
            {filteredResults.length} result
            {filteredResults.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Results grid ── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <DealCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => mutate()} />
      )}

      {!loading && !error && filteredResults.length === 0 && (
        <EmptyState onRetry={() => mutate()} />
      )}

      {!loading && !error && filteredResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map((car: ScanResult, idx: number) => (
            <div
              key={car.id}
              style={{
                animation: `fadeUp 200ms cubic-bezier(.16,1,.3,1) both`,
                animationDelay: `${Math.min(idx * 40, 400)}ms`,
              }}
            >
              <DealCard
                id={car.id}
                source={car.source}
                year={car.year}
                make={car.make}
                model={car.model}
                askPrice={car.askPrice}
                mmrValue={car.mmrValue}
                profitEstimate={car.profitEstimate}
                profitScore={car.profitScore}
                locationCity={car.locationCity}
                locationState={car.locationState}
                mileage={car.mileage}
                condition={car.condition}
                damageType={car.damageType}
                dealVerdict={car.dealVerdict}
                recommendedMaxBid={car.recommendedMaxBid}
                sellEstimate={car.sellEstimate}
                onClick={() => transitionTo(`/deal/${car.id}`)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Toasts */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
