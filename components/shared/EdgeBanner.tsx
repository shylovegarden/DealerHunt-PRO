"use client";

import useSWR from "swr";
import { Ico } from "@/components/shared/Ico";

// The "your edge today" strip — the first thing a logged-in user sees on Discover (cars) or Leads (homes).
// It quantifies the live opportunity on the board right now, from real data (/api/stats/proof). Motivating,
// not decorative: cars lead with the TOTAL profit sitting across every BUY; homes with fresh distressed flow.

const fetcher = (u: string) => fetch(u).then((r) => r.json());

const compactUSD = (n: number) =>
  n >= 1e6
    ? `$${(n / 1e6).toFixed(1)}M`
    : n >= 1e3
      ? `$${Math.round(n / 1e3)}K`
      : `$${Math.round(n)}`;

export function EdgeBanner({ kind }: { kind: "cars" | "homes" }) {
  const { data } = useSWR("/api/stats/proof", fetcher, {
    revalidateOnFocus: false,
  });
  if (!data) return null;

  const cars = kind === "cars";
  const grad = cars ? "var(--grad)" : "var(--grad-home)";
  const ink = cars ? "#fff" : "#04201d";

  const headline = cars
    ? `${compactUSD(data.totalSpread || 0)} in profit on the board`
    : `${(data.distressed || 0).toLocaleString()} distressed leads ready`;

  const bits = cars
    ? [
        `${(data.carsBuy || 0).toLocaleString()} BUY deals live`,
        `$${(data.avgSpread || 0).toLocaleString()} avg spread`,
        data.newBuys7d ? `${data.newBuys7d} new this week` : null,
      ]
    : [
        data.newLeads24h
          ? `${data.newLeads24h.toLocaleString()} new in the last 24h`
          : null,
        "scored by equity before anyone calls",
        `${(data.homesTracked || 0).toLocaleString()} tracked`,
      ];

  return (
    <div
      className="relative overflow-hidden rounded-[var(--r3)] px-5 py-4 md:px-6 md:py-5 mb-5 flex items-center gap-4"
      style={{ background: grad, color: ink }}
    >
      <span
        className="hidden sm:grid place-items-center w-11 h-11 rounded-[13px] shrink-0"
        style={{ background: "rgba(255,255,255,0.18)" }}
        aria-hidden
      >
        <Ico name={cars ? "trending-up" : "home"} size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] md:text-[19px] font-black leading-tight tracking-tight">
          {headline}
          <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-widest opacity-70">
            live now
          </span>
        </p>
        <p className="mt-1 text-[12px] md:text-[13px] font-semibold opacity-85 truncate">
          {bits.filter(Boolean).join("  ·  ")}
        </p>
      </div>
    </div>
  );
}
