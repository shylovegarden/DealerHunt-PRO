"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { usePreferences } from "@/hooks/usePreferences";
import { MyStatesButton } from "@/components/shared/MyStatesButton";

// HomeIQ FEED — the homes twin of the cars feed. A full-screen vertical snap-scroll of the hottest distressed
// leads: aerial-hero (most are off-market with no photo), price, distress badge, action rail (save / details),
// infinite scroll. Pulls /api/homeiq/feed.

interface FeedItem {
  id: string;
  title?: string;
  url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price: number | null;
  image: string | null;
  imageKind: string | null;
  beds?: number;
  baths?: number;
  sqft?: number;
  score: number | null;
  tier?: string;
  distress?: string | null;
  owner?: string | null;
}

const money = (n?: number | null) =>
  n != null ? `$${Math.round(n).toLocaleString()}` : "";

export default function HomeFeedPage() {
  const { prefs } = usePreferences();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [scope, setScope] = useState<string[] | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (busy.current || done) return;
    busy.current = true;
    setLoading(true);
    try {
      const qs = scope && scope.length ? `&states=${scope.join(",")}` : "";
      const res = await fetch(
        `/api/homeiq/feed?offset=${offset}&limit=12${qs}`,
      );
      const data = await res.json();
      const next: FeedItem[] = data.items || [];
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((n) => !seen.has(n.id))];
      });
      setOffset(data.nextOffset ?? offset + 12);
      if (next.length === 0) setDone(true);
    } catch {
      /* transient */
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }, [offset, done, scope]);

  // Seed scope from prefs (homeiqStates). Null = unknown; [] = explicitly all.
  useEffect(() => {
    if (scope === null && prefs)
      setScope((prefs.homeiqStates as string[]) || []);
  }, [prefs, scope]);

  const rescope = useCallback((states: string[]) => {
    setScope(states);
    setItems([]);
    setOffset(0);
    setDone(false);
    busy.current = false;
  }, []);

  useEffect(() => {
    if (scope === null) return;
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting) loadMore();
      },
      { rootMargin: "1200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div className="fixed inset-0 top-14 overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-hide">
      <div className="pointer-events-none fixed right-3 top-16 z-50">
        <div className="pointer-events-auto">
          <MyStatesButton
            vertical="homes"
            onChange={rescope}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-[13px] font-bold text-white backdrop-blur hover:bg-black/70"
          />
        </div>
      </div>

      {items.map((it) => (
        <FeedCard key={it.id} it={it} />
      ))}
      <div ref={sentinel} className="h-2" />
      {items.length === 0 && loading && (
        <div className="grid h-full place-items-center text-white/50">
          Loading leads…
        </div>
      )}
      {done && items.length === 0 && (
        <div className="grid h-full place-items-center px-8 text-center text-white/60">
          <div>
            <div className="mb-2 text-4xl">📍</div>
            <p className="font-bold text-white/80">
              No leads in your selected states yet
            </p>
            <p className="mt-1 text-sm">
              Tap “{scope?.length ? scope.join(", ") : "states"}” up top to add
              more — a new state starts harvesting on demand.
            </p>
          </div>
        </div>
      )}
      {done && items.length > 0 && (
        <div className="flex h-[40vh] snap-start items-center justify-center text-white/40">
          You’re all caught up 🏁
        </div>
      )}
    </div>
  );
}

function FeedCard({ it }: { it: FeedItem }) {
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (saved) return;
    setSaved(true);
    try {
      const res = await fetch("/api/homeiq/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: it.id }),
      });
      if (!res.ok) throw new Error();
      toast.success("Saved to your pipeline");
    } catch {
      setSaved(false);
      toast.error("Sign in to save leads");
    }
  };

  return (
    <section className="relative h-full min-h-full w-full snap-start snap-always overflow-hidden bg-black">
      {it.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={it.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-6xl opacity-30">
          🏡
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.92) 2%, transparent 42%, transparent 70%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      {/* Top-left: score + distress. */}
      <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
        {it.score != null && (
          <span
            className="rounded-full px-3 py-1 text-sm font-black text-black shadow-lg"
            style={{ background: "var(--home, #2dd4bf)" }}
          >
            {it.score}
          </span>
        )}
        {it.distress && (
          <span className="rounded-full bg-[var(--red)] px-2.5 py-1 text-xs font-black text-white">
            {it.distress}
          </span>
        )}
      </div>
      {it.imageKind && it.imageKind !== "listing" && (
        <span className="absolute right-3 top-4 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {it.imageKind === "aerial" ? "🛰 Aerial" : "🗺 Map"}
        </span>
      )}

      {/* Right action rail. */}
      <div className="absolute bottom-36 right-3 flex flex-col items-center gap-6">
        <button
          onClick={save}
          className="flex flex-col items-center gap-1"
          aria-label="Save"
        >
          <span
            className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-2xl backdrop-blur transition-transform active:scale-90"
            style={{ color: saved ? "var(--home, #2dd4bf)" : "#fff" }}
          >
            {saved ? "📌" : "🔖"}
          </span>
          <span className="text-[11px] font-bold text-white/90">Save</span>
        </button>
        <Link
          href={`/homeiq/leads/${encodeURIComponent(it.id)}`}
          className="flex flex-col items-center gap-1"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-xl text-white backdrop-blur">
            📊
          </span>
          <span className="text-[11px] font-bold text-white/90">Details</span>
        </Link>
      </div>

      {/* Bottom info. */}
      <div className="absolute inset-x-0 bottom-0 p-5 pb-10 pr-20">
        <div className="text-3xl font-black text-white drop-shadow">
          {it.price ? money(it.price) : "Off-market"}
        </div>
        <div className="mt-1 truncate text-lg font-bold text-white drop-shadow">
          {it.address || `${it.city || ""}`}
        </div>
        <div className="mt-0.5 text-sm text-white/75">
          {[
            it.beds && `${it.beds}bd`,
            it.baths && `${it.baths}ba`,
            it.sqft && `${it.sqft.toLocaleString()} sqft`,
          ]
            .filter(Boolean)
            .join(" · ")}
          {(it.beds || it.baths || it.sqft) && " · "}
          📍 {[it.city, it.state].filter(Boolean).join(", ") || it.state || "—"}
        </div>
        {it.owner && (
          <div className="mt-1 truncate text-xs text-white/55">
            Owner: {it.owner}
          </div>
        )}
      </div>
    </section>
  );
}
