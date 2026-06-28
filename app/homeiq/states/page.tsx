"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { US_STATES as STATES, nearestState } from "@/lib/housing/us-states";

// Full-country view — every state with its live lead count, heat-colored, click into one. "Detect my
// state" uses the browser's location → nearest state centroid (free, no API) so a user in Missouri lands
// on MO instantly, and can pick any other state. This is the map of the whole market.

const ACCENT = "#2dd4bf";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function StatesPage() {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const { data } = useSWR("/api/homeiq/market", fetcher, {
    revalidateOnFocus: false,
  });
  const byState: Record<string, number> = data?.byState ?? {};
  const total = data?.total ?? 0;
  const max = Math.max(1, ...Object.values(byState));

  const ordered = useMemo(
    () =>
      Object.keys(STATES).sort(
        (a, b) =>
          (byState[b] || 0) - (byState[a] || 0) ||
          STATES[a][0].localeCompare(STATES[b][0]),
      ),
    [byState],
  );

  const detect = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        router.push(
          `/homeiq/leads?state=${nearestState(pos.coords.latitude, pos.coords.longitude)}`,
        ),
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  return (
    <main className="min-h-screen bg-[var(--s1)] text-[var(--t1)]">
      <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between gap-3 flex-wrap">
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
            Markets
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/homeiq/leads"
            className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
          >
            All leads →
          </Link>
          <Link
            href="/welcome"
            className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
          >
            ← Switch
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <h1 className="text-[clamp(28px,5vw,52px)] font-black leading-tight">
          The whole market, by state
        </h1>
        <p className="mt-2 text-[var(--t3)]">
          <span className="font-black text-[var(--t1)]">
            {total.toLocaleString()}
          </span>{" "}
          live leads across the country. Pick your state — or let us find it.
        </p>
        <button
          onClick={detect}
          disabled={locating}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-black text-sm disabled:opacity-60"
          style={{ background: ACCENT }}
        >
          📍 {locating ? "Locating…" : "Detect my state"}
        </button>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {ordered.map((code) => {
          const count = byState[code] || 0;
          const intensity = count ? 0.12 + 0.6 * (count / max) : 0;
          return (
            <Link
              key={code}
              href={`/homeiq/leads?state=${code}`}
              className="rounded-[var(--r3)] border border-[var(--b1)] p-3 hover:border-[var(--b3)] transition-colors"
              style={{
                background: count
                  ? `rgba(45,212,191,${intensity})`
                  : "var(--s0)",
              }}
            >
              <div className="text-xs font-bold text-[var(--t2)] truncate">
                {STATES[code][0]}
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span
                  className="text-2xl font-black"
                  style={{ color: count ? "#062" : "var(--t4)" }}
                >
                  {count}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[var(--t4)]">
                  {code}
                </span>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
