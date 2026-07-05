"use client";

import Link from "next/link";
import useSWR from "swr";

// "For you" — the HOMES half of implicit learning made visible. Self-fetches /api/homeiq/recommendations
// (leads matched to what the investor saves: distress type, price band, property type) and renders nothing
// until enough saves exist. Mirrors the cars IntelRail; deliberately its own card so it stays decoupled.

const fetcher = (u: string) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error("failed");
    return r.json();
  });

const TIER_COLOR: Record<string, string> = {
  hot: "var(--red)",
  warm: "var(--amber)",
  standard: "var(--blue)",
};

interface Reco {
  id: string;
  title: string;
  price?: number;
  city?: string;
  state?: string;
  image?: string;
  score: number;
  tier: string;
  reason: string;
}

export function HomeIntelRail() {
  const { data, error } = useSWR("/api/homeiq/recommendations", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const deals: Reco[] = data?.deals ?? [];
  if (error || deals.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12">
      <h2 className="text-sm font-black uppercase tracking-widest text-[var(--t4)] mb-1">
        ✨ For you
      </h2>
      <p className="text-xs text-[var(--t4)] mb-3">
        Leads matched to what you keep saving — sharpens every time you save
        one.
      </p>
      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {deals.map((l) => (
          <Link
            key={l.id}
            href={`/homeiq/leads/${encodeURIComponent(l.id)}`}
            className="w-60 shrink-0 rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] overflow-hidden hover:border-[var(--b3)] transition-colors"
            style={{ scrollSnapAlign: "start" }}
          >
            <div className="relative h-32 bg-[var(--s2)]">
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
                style={{ background: TIER_COLOR[l.tier] || "var(--blue)" }}
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
              <div className="text-[11px] font-bold mt-1 text-[var(--home)]">
                {l.reason}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
