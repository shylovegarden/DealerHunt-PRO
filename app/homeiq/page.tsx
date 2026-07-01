"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { stateName, nearestState } from "@/lib/housing/us-states";
import { HomeIQSearch } from "@/components/home/HomeIQSearch";
import { HousingTicker } from "@/components/home/HousingTicker";
import { useCountUp } from "@/hooks/useCountUp";

// HomeIQ command center — the live, location-aware home. Real totals, the hottest markets, and featured
// hot leads, with one-tap "find leads near me". Same engine as DealerHunt Pro, pointed at houses, all free.

const ACCENT = "var(--home)";
const fetcher = (u: string) => fetch(u).then((r) => r.json());
const TIER_COLOR: Record<string, string> = {
  hot: "var(--red)",
  warm: "var(--amber)",
  standard: "var(--blue)",
};

interface Lead {
  id: string;
  title: string;
  price?: number;
  property_type?: string;
  city?: string;
  state?: string;
  image?: string;
  score: number;
  tier: string;
  mao?: number | null;
  verdict?: string;
}

export default function HomeIQHome() {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const { data } = useSWR(`/api/homeiq/leads?limit=300`, fetcher, {
    revalidateOnFocus: false,
  });
  const leads: Lead[] = data?.leads ?? [];
  const byState: Record<string, number> = data?.byState ?? {};
  const byTier = data?.byTier ?? { hot: 0, warm: 0, standard: 0 };
  const total = data?.total ?? 0;

  const topMarkets = Object.entries(byState)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const hot = leads.filter((l) => l.tier === "hot").slice(0, 6);

  const detect = () => {
    if (!navigator.geolocation) {
      router.push("/homeiq/states");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        router.push(
          `/homeiq/leads?state=${nearestState(p.coords.latitude, p.coords.longitude)}`,
        ),
      () => {
        setLocating(false);
        router.push("/homeiq/states");
      },
      { timeout: 8000 },
    );
  };

  return (
    <div className="bg-transparent text-[var(--t1)]">
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        {/* Ambient money-glow behind the headline — the value hits before you scroll. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 -left-10 w-[36rem] h-[22rem] -z-10 opacity-70"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--home) 22%, transparent), transparent)",
            filter: "blur(20px)",
          }}
        />
        <span
          className="text-[11px] font-black uppercase tracking-[0.3em]"
          style={{ color: ACCENT }}
        >
          Real estate leads
        </span>
        <h1 className="mt-3 text-[clamp(32px,6vw,64px)] font-black leading-[0.98]">
          Every distressed house,
          <br />
          deal-scored before anyone calls.
        </h1>
        <p className="mt-5 max-w-2xl text-[var(--t3)] text-lg leading-relaxed">
          Discounted, distressed, and foreclosure inventory — found, scored, and
          ranked by equity.{" "}
          <span className="text-[var(--t2)] font-semibold">
            All free, no paid data brokers.
          </span>
        </p>

        {/* Live stats — count up from 0 the instant the totals land. */}
        <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3 max-w-xl">
          <Stat
            label="Live leads"
            value={total}
            accent="var(--t1)"
            loading={!data}
          />
          <Stat
            label="🔥 Hot"
            value={byTier.hot ?? 0}
            accent="var(--red)"
            loading={!data}
          />
          <Stat
            label="States"
            value={Object.keys(byState).length}
            accent={ACCENT}
            loading={!data}
          />
        </div>

        {/* City / ZIP front door — type exactly where you want instead of picking a whole state. */}
        <div className="mt-6">
          <HomeIQSearch big />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={detect}
            disabled={locating}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-black text-sm disabled:opacity-60"
            style={{
              background: "var(--grad-home)",
              boxShadow: "0 8px 30px var(--home-bd)",
            }}
          >
            📍 {locating ? "Locating…" : "Find leads near me"}
          </button>
          <Link
            href="/homeiq/states"
            className="inline-flex items-center px-5 py-3 rounded-full font-bold text-sm border border-[var(--b1)] text-[var(--t2)] hover:border-[var(--b3)]"
          >
            🗺️ Browse all states
          </Link>
          <Link
            href="/homeiq/leads"
            className="inline-flex items-center px-5 py-3 rounded-full font-bold text-sm border border-[var(--b1)] text-[var(--t2)] hover:border-[var(--b3)]"
          >
            All leads →
          </Link>
          <Link
            href="/homeiq/market"
            className="inline-flex items-center px-5 py-3 rounded-full font-bold text-sm border border-[var(--b1)] text-[var(--t2)] hover:border-[var(--b3)]"
          >
            📊 Market data
          </Link>
        </div>
      </section>

      {/* Live ticker — hottest leads scrolling by, derived from the data already loaded. */}
      {leads.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-7">
          <HousingTicker leads={leads} />
        </div>
      )}

      {/* Top markets */}
      {topMarkets.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--t4)] mb-3">
            Hottest markets
          </h2>
          <div className="flex flex-wrap gap-2">
            {topMarkets.map(([code, count]) => (
              <Link
                key={code}
                href={`/homeiq/leads?state=${code}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--b1)] bg-[var(--s0)] hover:border-[var(--b3)] transition-colors"
              >
                <span className="font-bold text-[var(--t1)] text-sm">
                  {stateName(code)}
                </span>
                <span
                  className="text-xs font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--home-lo)", color: ACCENT }}
                >
                  {count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured hot leads */}
      {hot.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--t4)] mb-3">
            🔥 Hot right now
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {hot.map((l) => (
              <Link
                key={l.id}
                href={`/homeiq/leads/${encodeURIComponent(l.id)}`}
                className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] overflow-hidden hover:border-[var(--b3)] transition-colors"
              >
                <div className="relative h-36 bg-[var(--s2)]">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.image}
                      alt={l.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-[var(--t4)] text-xs">
                      No photo
                    </div>
                  )}
                  <span
                    className="absolute top-2 left-2 text-xs font-black px-2 py-0.5 rounded text-white"
                    style={{ background: TIER_COLOR[l.tier] }}
                  >
                    {l.score}
                  </span>
                </div>
                <div className="p-3">
                  <div className="font-black text-[var(--t1)]">
                    ${(l.price || 0).toLocaleString()}
                    <span className="font-medium text-sm text-[var(--t3)]">
                      {l.city
                        ? ` · ${l.city}, ${l.state || ""}`
                        : l.state
                          ? ` · ${l.state}`
                          : ""}
                    </span>
                  </div>
                  <h3 className="text-sm text-[var(--t2)] truncate mt-0.5">
                    {l.title}
                  </h3>
                  {l.mao != null && (
                    <div
                      className="text-[11px] font-bold mt-1"
                      style={{ color: ACCENT }}
                    >
                      Max offer ${l.mao.toLocaleString()} · {l.verdict}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: number;
  accent: string;
  loading?: boolean;
}) {
  const n = useCountUp(value, 900);
  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] px-3 sm:px-4 py-3">
      <div
        className="text-xl sm:text-2xl font-black tabular-nums"
        style={{ color: accent }}
      >
        {loading ? "—" : n.toLocaleString()}
      </div>
      <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[var(--t4)]">
        {label}
      </div>
    </div>
  );
}
