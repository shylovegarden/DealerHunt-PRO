"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";

// Full-country view — every state with its live lead count, heat-colored, click into one. "Detect my
// state" uses the browser's location → nearest state centroid (free, no API) so a user in Missouri lands
// on MO instantly, and can pick any other state. This is the map of the whole market.

const ACCENT = "#2dd4bf";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

// code → [name, lat, lng]. Centroids power "detect my state"; names + the grid drive the view.
const STATES: Record<string, [string, number, number]> = {
  AL: ["Alabama", 32.81, -86.79],
  AK: ["Alaska", 61.37, -152.4],
  AZ: ["Arizona", 33.73, -111.43],
  AR: ["Arkansas", 34.97, -92.37],
  CA: ["California", 36.12, -119.68],
  CO: ["Colorado", 39.06, -105.31],
  CT: ["Connecticut", 41.6, -72.76],
  DE: ["Delaware", 39.32, -75.51],
  FL: ["Florida", 27.77, -81.69],
  GA: ["Georgia", 33.04, -83.64],
  HI: ["Hawaii", 21.09, -157.5],
  ID: ["Idaho", 44.24, -114.48],
  IL: ["Illinois", 40.35, -88.99],
  IN: ["Indiana", 39.85, -86.26],
  IA: ["Iowa", 42.01, -93.21],
  KS: ["Kansas", 38.53, -96.73],
  KY: ["Kentucky", 37.67, -84.67],
  LA: ["Louisiana", 31.17, -91.87],
  ME: ["Maine", 44.69, -69.38],
  MD: ["Maryland", 39.06, -76.8],
  MA: ["Massachusetts", 42.23, -71.53],
  MI: ["Michigan", 43.33, -84.54],
  MN: ["Minnesota", 45.69, -93.9],
  MS: ["Mississippi", 32.74, -89.68],
  MO: ["Missouri", 38.46, -92.29],
  MT: ["Montana", 46.92, -110.45],
  NE: ["Nebraska", 41.13, -98.27],
  NV: ["Nevada", 38.31, -117.06],
  NH: ["New Hampshire", 43.45, -71.56],
  NJ: ["New Jersey", 40.3, -74.52],
  NM: ["New Mexico", 34.84, -106.25],
  NY: ["New York", 42.17, -74.95],
  NC: ["North Carolina", 35.63, -79.81],
  ND: ["North Dakota", 47.53, -99.78],
  OH: ["Ohio", 40.39, -82.76],
  OK: ["Oklahoma", 35.57, -96.93],
  OR: ["Oregon", 44.57, -122.07],
  PA: ["Pennsylvania", 40.59, -77.21],
  RI: ["Rhode Island", 41.68, -71.51],
  SC: ["South Carolina", 33.86, -80.95],
  SD: ["South Dakota", 44.3, -99.44],
  TN: ["Tennessee", 35.75, -86.69],
  TX: ["Texas", 31.05, -97.56],
  UT: ["Utah", 40.15, -111.86],
  VT: ["Vermont", 44.05, -72.71],
  VA: ["Virginia", 37.77, -78.17],
  WA: ["Washington", 47.38, -121.51],
  WV: ["West Virginia", 38.49, -80.95],
  WI: ["Wisconsin", 44.27, -89.62],
  WY: ["Wyoming", 42.76, -107.3],
  DC: ["D.C.", 38.9, -77.04],
};

function nearestState(lat: number, lng: number): string {
  let best = "MO",
    bestD = Infinity;
  for (const [code, [, sLat, sLng]] of Object.entries(STATES)) {
    const d = (lat - sLat) ** 2 + (lng - sLng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = code;
    }
  }
  return best;
}

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
