"use client";

import React, { useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDealStore } from "@/lib/store/dealStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Ico } from "@/components/shared/Ico";
import { Mono } from "@/components/shared/Mono";
import { useDealerId } from "@/hooks/useDealerId";
import { Skeleton } from "@/components/shared/Skeleton";
import { MaxBidWidget } from "@/components/deal/MaxBidWidget";
import { PriceSparkline } from "@/components/deal/PriceSparkline";
import { SimilarDeals } from "@/components/deal/SimilarDeals";
import { MarketTiming } from "@/components/deal/MarketTiming";
import { AIBrief } from "@/components/deal/AIBrief";
import { DealIQCard } from "@/components/deal/DealIQCard";
import { MarketContext } from "@/components/deal/MarketContext";
import useDealerDefaults from "@/hooks/useDealerDefaults";

// Fetcher function for SWR
const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  });

export default function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const store = useDealStore();
  const { dealerId, loading: dealerLoading } = useDealerId();
  const { targetProfit: savedTargetProfit } = useDealerDefaults();
  // The dealer's learned calibration (null until they've logged enough outcomes).
  const { data: calData } = useSWR("/api/calibration", fetcher, {
    revalidateOnFocus: false,
  });
  const calibration = calData?.calibration ?? null;
  const { id } = React.use(params);
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [watching, setWatching] = React.useState(false);
  const loadedDealIdRef = React.useRef<string | null>(null);

  // Use SWR for data fetching
  const {
    data: dealData,
    error,
    isLoading,
  } = useSWR(
    dealerId && !dealerLoading && id
      ? `/api/deals/${id}?dealerId=${dealerId}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    },
  );

  const loading = isLoading || dealerLoading;
  const authError =
    !dealerLoading && !dealerId ? "Please sign in to view deal details." : null;

  const handleSaveToFleet = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: store.vin || "", // VIN often isn't in the listing — can be filled in later
          year: store.year,
          make: store.make,
          model: store.model,
          condition: store.titleType || "clean",
          purchasePrice: store.askPrice,
          auctionFee: store.auctionFee,
          transportCost: store.transportCost,
          repairCost: store.repairCost,
          reconCost: store.reconCost,
          titleFee: store.titleFee,
          marketValue: store.marketValue,
          stage: "acquired",
          // Close-the-loop: snapshot the source deal + the engine's prediction at purchase time.
          dealId: id,
          predictedProfit: dealData?.deal?.trueNetProfit ?? store.netProfit,
          predictedSell: dealData?.deal?.sellEstimate ?? store.marketValue,
          predictedTransport:
            dealData?.deal?.dealAnalysis?.costs?.transport ??
            store.transportCost,
          predictedRecon:
            dealData?.deal?.dealAnalysis?.costs?.repair ?? store.reconCost,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error("Failed to save to fleet");
      } else {
        toast.success("Added to fleet", {
          description: `${[store.year, store.make, store.model].filter(Boolean).join(" ")} is now in your pipeline.`,
          action: { label: "View Fleet", onClick: () => router.push("/fleet") },
        });
      }
    } catch (e: any) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleWatchPrice = async () => {
    setWatching(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_id: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add to watchlist");
      }
      toast.success("Watching this deal for price changes");
    } catch (e: any) {
      toast.error(e.message || "Failed to watch deal");
    } finally {
      setWatching(false);
    }
  };

  // Update store when data loads — guard with ref to prevent infinite loop
  useEffect(() => {
    if (dealData?.deal && loadedDealIdRef.current !== id) {
      loadedDealIdRef.current = id;
      store.addDealToCache(id, dealData.deal);
      store.loadDeal(dealData.deal);
    } else if (error && loadedDealIdRef.current !== id) {
      loadedDealIdRef.current = id;
      // Try to load from cache on error
      const cached = store.cachedDeals?.[id];
      if (cached) {
        store.loadDeal(cached);
      }
    }
  }, [dealData, error, id]);

  const formatMoney = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  // Authoritative numbers come from the SERVER decision engine (comps + full cost model).
  // Fall back to the client store only when the engine hasn't produced a verdict.
  const serverDeal = dealData?.deal;
  const hasEngine = !!serverDeal?.dealVerdict;
  const engineVerdict = (
    hasEngine ? String(serverDeal.dealVerdict).toUpperCase() : store.verdict
  ) as "GO" | "HOLD" | "PASS";
  const engineNetProfit =
    hasEngine && serverDeal.true_net_profit != null
      ? Number(serverDeal.true_net_profit)
      : store.netProfit;
  const engineScore =
    hasEngine && serverDeal.profitScore != null
      ? Number(serverDeal.profitScore)
      : store.profitScore;
  const engineRoi =
    hasEngine && serverDeal?.dealAnalysis?.roi != null
      ? Number(serverDeal.dealAnalysis.roi)
      : store.roi;
  // The client store recompute is reframed as a "what-if" adjusted estimate (see ledger).

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto mt-4">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-44 lg:col-span-2" />
          <Skeleton className="h-44" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  if (authError || error) {
    return (
      <div className="max-w-5xl mx-auto mt-12">
        <ErrorState
          title="Couldn't load deal"
          message={
            authError ||
            `Error loading deal: ${error?.message || "Unknown error"}`
          }
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeUp pb-24">
      {/* HEADER & USER TYPE */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge
              variant="outline"
              className="text-[var(--t1)] bg-white border-[var(--b1)]"
            >
              {store.year} {store.make} {store.model}
            </Badge>
            <Badge
              className="text-white uppercase tracking-wider text-[10px] border-none"
              style={{ background: "var(--grad)" }}
            >
              {store.titleType} Title
            </Badge>
          </div>
          <p className="text-[var(--t4)] text-sm">
            {[
              dealData?.deal?.source,
              [dealData?.deal?.locationCity, dealData?.deal?.locationState]
                .filter(Boolean)
                .join(", "),
              store.miles ? `${store.miles.toLocaleString()} mi` : null,
            ]
              .filter(Boolean)
              .join(" • ") || "Deal details"}
          </p>
        </div>

        {/* The 3-User Toggle */}
        <div
          className="flex p-1 rounded-xl"
          style={{ background: "var(--s0)", boxShadow: "var(--shadow2)" }}
        >
          {(["dealer", "private", "parts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => store.setUserType(t)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all border-none ${store.userType === t ? "text-white" : "text-[var(--t4)] hover:text-[var(--t1)]"}`}
              style={store.userType === t ? { background: "var(--grad)" } : {}}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ENGINE DECISION (authoritative, server-computed from comps + full cost model) */}
      {dealData?.deal?.dealVerdict &&
        (() => {
          const d = dealData.deal;
          const a = d.dealAnalysis || {};
          const verdict = String(d.dealVerdict).toUpperCase();
          const vColor =
            verdict === "GO"
              ? "var(--green)"
              : verdict === "HOLD"
                ? "var(--amber)"
                : "var(--red)";
          const basisLabel =
            a.sellBasis === "comps"
              ? "real retail comps"
              : a.sellBasis === "market"
                ? "market value"
                : "estimated markup";
          return (
            <Card
              className="border-none overflow-hidden"
              style={{ background: "var(--s0)", boxShadow: "var(--shadow)" }}
            >
              <div className="h-1 w-full" style={{ background: vColor }} />
              <CardContent className="p-6 md:p-7">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--t4)] font-bold mb-4">
                  The Decision
                </p>
                <div className="flex flex-wrap items-center justify-between gap-5">
                  <div className="flex items-center gap-4 md:gap-5">
                    <div
                      className="px-5 py-3 rounded-[var(--r3)] text-white font-black text-2xl tracking-wide leading-none"
                      style={{ background: vColor }}
                    >
                      {verdict}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--t4)] font-bold mb-1">
                        Recommended max bid
                      </p>
                      <Mono className="text-3xl md:text-4xl font-black text-[var(--t1)] leading-none">
                        {d.recommendedMaxBid != null
                          ? formatMoney(d.recommendedMaxBid)
                          : "—"}
                      </Mono>
                      <p className="text-xs text-[var(--t3)] font-semibold mt-1.5">
                        Net profit {formatMoney(d.true_net_profit ?? 0)}
                        {a.roi != null ? ` · ${a.roi}% ROI` : ""} · score{" "}
                        {d.profitScore ?? "—"}/130
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--t4)] font-bold">
                      Est. resale
                    </p>
                    <Mono className="text-xl font-black text-[var(--t1)]">
                      {d.sellEstimate != null
                        ? formatMoney(d.sellEstimate)
                        : "—"}
                    </Mono>
                    <p className="text-[10px] text-[var(--t4)]">
                      via {basisLabel}
                    </p>
                  </div>
                </div>
                {(a.warnings?.length > 0 || a.recommendations?.length > 0) && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--b1)]">
                    {(a.warnings || []).map((w: string, i: number) => (
                      <span
                        key={`w${i}`}
                        className="text-xs font-semibold text-white px-2.5 py-1 rounded-md"
                        style={{ background: "var(--red)" }}
                      >
                        ⚠ {w}
                      </span>
                    ))}
                    {(a.recommendations || []).map((r: string, i: number) => (
                      <span
                        key={`r${i}`}
                        className="text-xs font-semibold text-[var(--t2)] px-2.5 py-1 rounded-md bg-[var(--s1)]"
                      >
                        ✓ {r}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

      {/* MAX BID ENGINE + PRICE HISTORY (Name-your-price / price-trend) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MaxBidWidget
            sellEstimate={dealData?.deal?.sellEstimate}
            source={dealData?.deal?.source}
            askPrice={dealData?.deal?.askPrice ?? store.askPrice}
            costs={dealData?.deal?.dealAnalysis?.costs}
            defaultTargetProfit={savedTargetProfit}
            calibration={calibration}
          />
        </div>
        <PriceSparkline dealId={id} />
      </div>

      {/* MARKET TIMING — buy-now/wait + real days-to-sell */}
      <MarketTiming
        make={dealData?.deal?.make ?? store.make}
        model={dealData?.deal?.model ?? store.model}
      />

      {/* TOP READOUT (The 60-Second Decision) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          className="col-span-1 lg:col-span-2 border-none bg-[var(--s0)]"
          style={{ boxShadow: "var(--shadow2)" }}
        >
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm font-bold text-[var(--t4)] uppercase tracking-widest mb-1">
                  {store.userType === "parts"
                    ? "Part-out ROI"
                    : store.userType === "private"
                      ? "Savings vs Market"
                      : "Net Profit"}
                </p>
                <div className="text-5xl font-bold text-[var(--t1)] flex items-center gap-3 serif">
                  {formatMoney(engineNetProfit)}
                  <Badge
                    className="text-white border-none px-2 py-1 text-sm"
                    style={{ background: "var(--green)" }}
                  >
                    {engineRoi}% ROI
                  </Badge>
                </div>
                {/* The interactive ledger below is a what-if sandbox; show its result only as
                    a secondary "adjusted" figure so it never competes with the engine verdict. */}
                {store.netProfit !== engineNetProfit && (
                  <p className="text-[11px] text-[var(--t4)] mt-1.5">
                    Your adjusted estimate:{" "}
                    <span className="font-bold text-[var(--t3)]">
                      {formatMoney(store.netProfit)}
                    </span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[var(--t4)] uppercase tracking-widest mb-1">
                  Verdict
                </p>
                <div
                  className={`text-4xl font-bold ${engineVerdict === "GO" ? "text-[var(--green)]" : engineVerdict === "HOLD" ? "text-[var(--amber)]" : "text-[var(--red)]"}`}
                >
                  {engineVerdict}
                </div>
              </div>
            </div>

            {/* The EDGE Features Row */}
            <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-[var(--b1)]">
              {/* Carrying Cost Clock */}
              {store.userType === "dealer" && (
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--t2)] bg-[var(--s1)] px-3 py-1.5 rounded-md">
                  <Ico name="clock" size={14} className="text-[var(--t4)]" />
                  Break-even: Day{" "}
                  {Math.floor(store.netProfit / store.floorRate)} of{" "}
                  {store.estimatedDaysToSell}-day target
                </div>
              )}
              {/* Geo-Arbitrage */}
              {store.transportCost < 1000 &&
                store.netProfit > 2500 &&
                store.userType === "dealer" && (
                  <div className="flex items-center gap-2 text-xs font-bold text-white bg-[var(--purple)] px-3 py-1.5 rounded-md shadow-sm">
                    <Ico name="trending-up" size={14} />
                    {dealData?.deal?.locationState
                      ? `Geo-Arbitrage: low transport from ${dealData.deal.locationState}`
                      : "Geo-Arbitrage: low transport opportunity"}
                  </div>
                )}
              {/* Recalls */}
              {store.openRecalls > 0 ? (
                <div className="flex items-center gap-2 text-xs font-bold text-white bg-[var(--red)] px-3 py-1.5 rounded-md shadow-sm">
                  <Ico name="alert-triangle" size={14} />
                  {store.openRecalls} Open NHTSA Recalls
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--t2)] bg-[var(--s1)] px-3 py-1.5 rounded-md">
                  <Ico
                    name="check-circle"
                    size={14}
                    className="text-[var(--green)]"
                  />
                  0 Open Recalls
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* The Algorithm Score */}
        <Card className="col-span-1 border-[var(--b2)] bg-[var(--s0)] shadow-sm flex flex-col justify-center items-center p-6 text-center">
          <p className="text-sm font-bold text-[var(--t3)] uppercase tracking-widest mb-2">
            Deal Score
          </p>
          <div className="relative inline-flex items-center justify-center w-32 h-32 mb-2">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="var(--s2)"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke={
                  engineScore >= 80
                    ? "var(--green)"
                    : engineScore >= 60
                      ? "var(--amber)"
                      : "var(--red)"
                }
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="351.8"
                strokeDashoffset={
                  351.8 -
                  (351.8 * Math.max(0, Math.min(100, engineScore))) / 100
                }
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-4xl font-black text-[var(--t1)]">
              {engineScore}
            </div>
          </div>
          <p className="text-xs text-[var(--t4)] max-w-[200px] leading-tight">
            Based on ROI, Margin, Demand, Mileage, and Title Risk.
          </p>
        </Card>
      </div>

      {/* MIDDLE SECTION (The Interactive Ledger — secondary) */}
      <div className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--t4)] px-1 mb-1">
          Adjust assumptions
        </p>
        <p className="text-xs text-[var(--t4)] px-1 mb-3">
          Fine-tune costs and market value to see how the numbers move. The
          decision above uses the engine&apos;s estimates.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Value & Ask */}
        <Card className="border-[var(--b2)] shadow-sm">
          <CardHeader className="bg-[var(--s1)] border-b border-[var(--b1)] py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">
              Market & Acquisition
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--t2)] flex-1">
                Ask Price
              </label>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)] font-bold">
                  $
                </span>
                <Input
                  type="number"
                  value={store.askPrice || ""}
                  onChange={(e) =>
                    store.updateField("askPrice", Number(e.target.value))
                  }
                  className="pl-7 font-[var(--fm)] font-bold bg-white text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--b1)] pt-4">
              <div className="flex-1">
                <label className="text-sm font-bold text-[var(--t2)]">
                  {store.userType === "parts"
                    ? "Est. Parts Value"
                    : "MMR Market Value"}
                </label>
                <p className="text-[10px] text-[var(--t4)]">
                  Editable estimate
                </p>
              </div>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)] font-bold">
                  $
                </span>
                <Input
                  type="number"
                  value={store.marketValue || ""}
                  onChange={(e) =>
                    store.updateField("marketValue", Number(e.target.value))
                  }
                  className="pl-7 font-[var(--fm)] font-bold bg-[var(--s1)] text-right border-dashed"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: The Costs */}
        <Card className="border-[var(--b2)] shadow-sm">
          <CardHeader className="bg-[var(--s1)] border-b border-[var(--b1)] py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">
              Cost Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--b1)]">
              {store.userType !== "private" && (
                <CostRow
                  label="Auction Fee"
                  value={store.auctionFee}
                  onChange={(val) => store.updateField("auctionFee", val)}
                />
              )}
              <CostRow
                label="Transport"
                value={store.transportCost}
                onChange={(val) => store.updateField("transportCost", val)}
              />
              {store.userType !== "parts" && (
                <CostRow
                  label="Repair Est"
                  value={store.repairCost}
                  onChange={(val) => store.updateField("repairCost", val)}
                />
              )}
              {store.userType === "dealer" && (
                <CostRow
                  label="Recon / Detail"
                  value={store.reconCost}
                  onChange={(val) => store.updateField("reconCost", val)}
                />
              )}
              {store.userType !== "parts" && (
                <CostRow
                  label="Title / Doc"
                  value={store.titleFee}
                  onChange={(val) => store.updateField("titleFee", val)}
                />
              )}
              {store.userType === "dealer" && (
                <CostRow
                  label={`Holding (${store.estimatedDaysToSell} days @ $${store.floorRate})`}
                  value={store.floorRate * store.estimatedDaysToSell}
                  readOnly
                />
              )}
              {store.userType === "private" && (
                <>
                  <CostRow
                    label="Est. Insurance (1 YR)"
                    value={store.annualInsurance}
                    onChange={(val) =>
                      store.updateField("annualInsurance", val)
                    }
                  />
                  <CostRow
                    label="Est. Maintenance (1 YR)"
                    value={store.annualMaintenance}
                    onChange={(val) =>
                      store.updateField("annualMaintenance", val)
                    }
                  />
                </>
              )}
            </div>
            <div className="p-4 bg-[var(--s1)] border-t border-[var(--b1)] flex justify-between items-center rounded-b-[var(--r2)]">
              <span className="font-bold text-[var(--t2)] uppercase tracking-wider text-sm">
                Total Cost Basis
              </span>
              <Mono className="text-lg font-black text-[var(--t1)]">
                {formatMoney(store.totalCost)}
              </Mono>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DEAL IQ — fused, explainable intelligence score */}
      <DealIQCard dealId={id} />

      {/* MARKET CONTEXT — days-on-market, depreciation, time-travel, cross-source prices */}
      <MarketContext dealId={id} />

      {/* AI BRIEF — on-demand plain-English verdict rationale + risks */}
      <AIBrief dealId={id} />

      {/* SIMILAR DEALS — semantic (pgvector) with attribute fallback */}
      <SimilarDeals dealId={id} />

      {/* FIXED BOTTOM ACTION BAR — sits ABOVE the mobile BottomNav (which is itself bottom-0), so
          the two fixed bars don't overlap on phones; flush to the bottom on desktop (no BottomNav). */}
      <div
        className="fixed left-0 right-0 p-3 md:p-4 z-50 bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0"
        style={{
          background: "var(--s0)",
          borderTop: "1px solid var(--b1)",
          boxShadow: "var(--shadow2)",
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-wrap justify-end gap-2 md:gap-3">
          <Button
            variant="outline"
            onClick={handleWatchPrice}
            disabled={watching}
            className="border-[var(--b2)] text-[var(--t3)] font-semibold text-xs md:text-sm h-10 md:h-11 rounded-xl"
          >
            {watching ? "Adding…" : "Watch Price"}
          </Button>
          <Button
            onClick={() => {
              const fromState = dealData?.deal?.locationState;
              const params = new URLSearchParams({ dealId: id });
              if (fromState) params.set("from", fromState);
              router.push(`/move?${params.toString()}`);
            }}
            className="text-white font-semibold text-xs md:text-sm h-10 md:h-11 rounded-xl"
            style={{ background: "var(--t1)" }}
          >
            Get Transport
          </Button>
          {store.userType === "dealer" && (
            <Button
              onClick={handleSaveToFleet}
              disabled={saving}
              className="text-white font-bold text-xs md:text-sm h-10 md:h-11 rounded-xl"
              style={{ background: "var(--grad)" }}
            >
              {saving ? "Saving..." : "Add to Fleet"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent for ledger rows
function CostRow({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: number;
  onChange?: (val: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 px-5 hover:bg-[var(--s1)] transition-colors">
      <span className="text-sm font-semibold text-[var(--t2)]">{label}</span>
      <div className="relative w-28">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t4)] font-bold text-sm">
          $
        </span>
        {readOnly ? (
          <div className="pl-7 py-2 pr-3 text-right font-[var(--fm)] font-bold text-[var(--t3)]">
            {value}
          </div>
        ) : (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => onChange?.(Number(e.target.value))}
            className="h-8 pl-7 font-[var(--fm)] font-bold bg-transparent border-transparent hover:border-[var(--b2)] focus:border-[var(--amber)] focus:bg-white text-right text-sm px-2 shadow-none rounded"
          />
        )}
      </div>
    </div>
  );
}
