"use client";

import React from "react";
import useSWR from "swr";
import { Mono } from "@/components/shared/Mono";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const ago = (iso?: string | null) => {
  if (!iso) return "never";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: any;
  tone?: string;
}) {
  return (
    <div className="glass-panel p-4">
      <Mono
        className="text-2xl font-black"
        style={{ fontFamily: "var(--fm)", color: tone || "var(--t1)" }}
      >
        {value}
      </Mono>
      <p className="text-[11px] text-[var(--t4)] font-semibold mt-1">{label}</p>
    </div>
  );
}

function Bar({ label, pct }: { label: string; pct: number }) {
  const tone =
    pct >= 70 ? "var(--green)" : pct >= 35 ? "var(--amber)" : "var(--red)";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--t3)]">{label}</span>
        <Mono style={{ fontFamily: "var(--fm)", color: tone }}>{pct}%</Mono>
      </div>
      <div className="h-2 rounded-full" style={{ background: "var(--s3)" }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.max(2, pct)}%`, background: tone }}
        />
      </div>
    </div>
  );
}

export default function StatusPage() {
  const { data } = useSWR("/api/system/status", fetcher, {
    refreshInterval: 60_000,
  });
  const f = data?.freshness;
  const q = data?.quality;
  const l = data?.learning;
  const sources: any[] = data?.sources ?? [];
  const runs: any[] = data?.recentRuns ?? [];

  return (
    <div
      className="max-w-5xl mx-auto px-4 py-8 space-y-6"
      style={{ animation: "fadeUp 300ms ease-out" }}
    >
      <div>
        <h1 className="text-2xl font-black text-[var(--t1)] mb-1">
          System Status
        </h1>
        <p className="text-[var(--t3)] text-sm">
          The pipeline watches itself — freshness, source health, and data
          quality.
        </p>
      </div>

      {!data ? (
        <div className="glass-panel p-8 text-center text-[var(--t4)] text-sm">
          Loading…
        </div>
      ) : (
        <>
          {/* Freshness */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              label="Active deals"
              value={(f?.activeDeals ?? 0).toLocaleString()}
            />
            <Stat
              label="New (24h)"
              value={(f?.newLast24h ?? 0).toLocaleString()}
              tone="var(--green)"
            />
            <Stat
              label="GO deals"
              value={(q?.goDeals ?? 0).toLocaleString()}
              tone="var(--amber)"
            />
            <Stat
              label="Data freshness"
              value={f?.stale ? "STALE" : "FRESH"}
              tone={f?.stale ? "var(--red)" : "var(--green)"}
            />
          </div>

          {/* Quality coverage */}
          <div className="glass-panel p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--t4)] font-bold">
              Data quality coverage
            </p>
            <Bar label="Has photos" pct={q?.imagePct ?? 0} />
            <Bar label="Geocoded (mappable)" pct={q?.geocodedPct ?? 0} />
            <Bar label="Has city" pct={q?.cityPct ?? 0} />
            <Bar label="Has VIN" pct={q?.vinPct ?? 0} />
          </div>

          {/* Closed-loop learning */}
          <div className="glass-panel p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--t4)] font-bold mb-2">
              Learning loop
            </p>
            {l?.outcomesLogged > 0 ? (
              <>
                <p className="text-sm text-[var(--t2)] mb-3">
                  Learning from{" "}
                  <Mono
                    style={{ fontFamily: "var(--fm)" }}
                    className="font-bold text-[var(--t1)]"
                  >
                    {l.outcomesLogged}
                  </Mono>{" "}
                  logged outcome{l.outcomesLogged === 1 ? "" : "s"} — the
                  pipeline now prioritizes the makes you actually profit on.
                </p>
                {l.prioritizedMakes?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {l.prioritizedMakes.map((m: string) => (
                      <span
                        key={m}
                        className="rounded-full px-2.5 py-1 text-xs font-bold capitalize"
                        style={{
                          background: "var(--glo)",
                          color: "var(--green)",
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--t4)]">
                    No profitable make yet — log a winning sale to start the
                    loop.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--t4)]">
                Log sold deals in Intel and the pipeline starts prioritizing the
                segments you profit on — scraping, enrichment, and scoring all
                bend toward your wins.
              </p>
            )}
          </div>

          {/* Source health */}
          <div className="glass-panel p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--t4)] font-bold mb-3">
              Source health (7d)
            </p>
            {sources.length === 0 ? (
              <p className="text-sm text-[var(--t4)]">
                No scrape runs recorded yet. Runs appear here once the scraper
                executes.
              </p>
            ) : (
              <div className="divide-y divide-[var(--b1)]">
                {sources.map((s) => {
                  const rate = s.runs_7d
                    ? Math.round((s.ok_7d / s.runs_7d) * 100)
                    : 0;
                  const dead = s.last3_all_failed;
                  return (
                    <div
                      key={s.source}
                      className="flex items-center justify-between py-2.5 gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            background: dead
                              ? "var(--red)"
                              : rate >= 80
                                ? "var(--green)"
                                : "var(--amber)",
                          }}
                        />
                        <span className="text-sm font-bold text-[var(--t1)] capitalize">
                          {s.source.replace(/_/g, " ")}
                        </span>
                        {dead && (
                          <span className="text-[10px] font-bold text-[var(--red)] uppercase">
                            paused (self-heal)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--t4)]">
                        <span>{rate}% ok</span>
                        <span>~{Number(s.avg_deals) || 0} deals</span>
                        <span>{ago(s.last_ok)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent runs */}
          {runs.length > 0 && (
            <div className="glass-panel p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--t4)] font-bold mb-3">
                Recent runs
              </p>
              <div className="divide-y divide-[var(--b1)]">
                {runs.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: r.ok ? "var(--green)" : "var(--red)",
                        }}
                      />
                      <span className="text-[var(--t2)] font-semibold capitalize">
                        {r.source.replace(/_/g, " ")}
                      </span>
                    </span>
                    <span className="text-[var(--t4)]">
                      {r.deals_found} deals ·{" "}
                      {Math.round((r.duration_ms || 0) / 1000)}s ·{" "}
                      {ago(r.run_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
