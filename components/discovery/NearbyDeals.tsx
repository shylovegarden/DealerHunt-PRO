"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { usePreferences } from "@/hooks/usePreferences";
import { nearbyStates } from "@/lib/housing/us-states";

// "Deals near you" — a customizable dashboard widget that surfaces engine-rated BUY deals in the user's
// saved state + surrounding states (radius adjustable). Reads the saved carsState from /api/preferences,
// so it personalizes to the user's location. Hidden until a state is set (prompt points to Settings).

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const money = (n?: number | null) =>
  n != null ? `$${Math.round(n).toLocaleString()}` : "—";

interface NearbyDeal {
  id: string;
  make?: string;
  model?: string;
  year?: number;
  askPrice?: number;
  true_net_profit?: number;
  locationState?: string;
  images?: string[];
}

const RADII = [
  { n: 2, label: "Close" },
  { n: 4, label: "Nearby" },
  { n: 7, label: "Wide" },
];

export function NearbyDeals() {
  const { prefs, authed } = usePreferences();
  const home = (prefs.carsState || "").toUpperCase();
  const [radius, setRadius] = useState(4);

  const states = home ? [home, ...Array.from(nearbyStates(home, radius))] : [];
  const key = home
    ? `/api/scan?states=${states.join(",")}&verdict=go&sort=profit`
    : null;
  const { data, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
    keepPreviousData: true, // keep deals visible while changing radius — no flash
  });

  // No saved location → nudge to Settings instead of showing an empty widget.
  if (authed && !home) {
    return (
      <div className="rounded-[var(--r3)] border border-dashed border-[var(--b2)] p-4 text-sm text-[var(--t4)]">
        Set your home market in{" "}
        <Link href="/settings" className="font-semibold text-[var(--t2)]">
          Settings
        </Link>{" "}
        to see BUY deals near you.
      </div>
    );
  }
  if (!home) return null;

  const deals: NearbyDeal[] = (data?.vehicles || data?.deals || []).slice(0, 8);

  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-black text-[var(--t1)]">
          BUY deals near {home}
        </h2>
        {/* Customizable radius */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-full"
          style={{ background: "var(--s2)" }}
        >
          {RADII.map((r) => {
            const active = radius === r.n;
            return (
              <button
                key={r.n}
                onClick={() => setRadius(r.n)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
                style={{
                  background: active ? "var(--s0)" : "transparent",
                  color: active ? "var(--t1)" : "var(--t4)",
                  boxShadow: active ? "var(--shadow2)" : "none",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-[var(--t4)] py-6 text-center">Loading…</p>
      ) : deals.length === 0 ? (
        <p className="text-xs text-[var(--t4)] py-6 text-center">
          No BUY deals in {states.join(", ")} right now — widen the radius.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {deals.map((d) => (
            <Link
              key={d.id}
              href={`/deal/${d.id}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--b1)] bg-[var(--s1)] p-2.5 hover:border-[var(--b3)] transition-colors"
            >
              <div className="h-12 w-16 shrink-0 rounded-lg bg-[var(--s2)] overflow-hidden grid place-items-center">
                {d.images?.[0] && d.images[0].startsWith("http") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.images[0]}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  // No photo → a subtle car glyph instead of an empty box.
                  <span className="text-lg opacity-40" aria-hidden>
                    🚗
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-[var(--t1)] truncate">
                  {d.year} {d.make} {d.model}
                </div>
                <div className="text-[11px] text-[var(--t4)]">
                  {money(d.askPrice)} · {d.locationState}
                  {d.true_net_profit != null && d.true_net_profit > 0 && (
                    <span className="text-[var(--green)] font-bold">
                      {" "}
                      · +{money(d.true_net_profit)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
