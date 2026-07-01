"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { US_STATES as STATES, nearestState } from "@/lib/housing/us-states";
import { HomeIQSearch } from "@/components/home/HomeIQSearch";

// Full-country view — every state with its live lead count, heat-colored, click into one. "Detect my
// state" uses the browser's location → nearest state centroid (free, no API) so a user in Missouri lands
// on MO instantly, and can pick any other state. This is the map of the whole market.

const ACCENT = "var(--home)";
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
    if (!navigator.geolocation) {
      toast.error("Location isn't available — pick a state below.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        router.push(
          `/homeiq/leads?state=${nearestState(pos.coords.latitude, pos.coords.longitude)}`,
        ),
      () => {
        setLocating(false);
        toast.error("Couldn't detect your location — pick a state below.");
      },
      { timeout: 8000 },
    );
  };

  return (
    <div className="bg-transparent text-[var(--t1)]">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <h1 className="text-[clamp(28px,5vw,52px)] font-black leading-tight">
          The whole market, by state
        </h1>
        <p className="mt-2 text-[var(--t3)]">
          <span className="font-black text-[var(--t1)]">
            {total.toLocaleString()}
          </span>{" "}
          live leads across the country. Search a city or ZIP — or pick your
          state below.
        </p>
        <div className="mt-4">
          <HomeIQSearch />
        </div>
        <button
          onClick={detect}
          disabled={locating}
          className="mt-3 inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-black text-sm disabled:opacity-60"
          style={{
            background: "var(--grad-home)",
            boxShadow: "0 8px 30px var(--home-bd)",
          }}
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
                  ? `color-mix(in srgb, var(--home) ${Math.round(intensity * 100)}%, transparent)`
                  : "var(--s0)",
              }}
            >
              <div className="text-xs font-bold text-[var(--t2)] truncate">
                {STATES[code][0]}
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span
                  className="text-2xl font-black"
                  style={{ color: count ? "var(--t1)" : "var(--t4)" }}
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
    </div>
  );
}
