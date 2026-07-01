"use client";

import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";

// The alerts home — where the "🔔 Alert me" promise pays off. Two halves: the user's saved searches (the
// criteria the harvest matches against) and the INBOX of new hot/warm properties that have matched. Before
// this page, matches were stored (housing_feed_inbox) but only surfaced via email — invisible in-app.

const ACCENT = "var(--home)";
const fetcher = (u: string) => fetch(u).then((r) => r.json());
const TIER_COLOR: Record<string, string> = {
  hot: "var(--red)",
  warm: "var(--amber)",
  standard: "var(--blue)",
};
const money = (n?: number | null) =>
  n != null ? `$${Math.round(n).toLocaleString()}` : "—";

interface SavedSearch {
  id: string;
  name: string;
  state?: string;
  city?: string;
  zip?: string;
  property_type?: string;
  source?: string;
  min_price?: number;
  max_price?: number;
  tier?: string;
  notify_email?: boolean;
}
interface Match {
  id: string;
  title: string;
  price?: number;
  city?: string;
  state?: string;
  image?: string;
  score?: number;
  tier?: string;
  matchedAt?: string;
}

export default function AlertsPage() {
  const searches = useSWR<SavedSearch[] | { error: string }>(
    "/api/homeiq/saved-searches",
    fetcher,
    { revalidateOnFocus: false },
  );
  const inbox = useSWR<{ matches: Match[] } | { error: string }>(
    "/api/homeiq/alerts",
    fetcher,
    { revalidateOnFocus: false },
  );

  const unauth =
    (searches.data && !Array.isArray(searches.data)) ||
    (inbox.data && "error" in (inbox.data as any));
  const rows: SavedSearch[] = Array.isArray(searches.data) ? searches.data : [];
  const matches: Match[] =
    inbox.data && "matches" in inbox.data ? inbox.data.matches : [];

  const remove = async (id: string) => {
    searches.mutate(rows.filter((r) => r.id !== id) as any, false);
    await fetch(`/api/homeiq/saved-searches?id=${id}`, { method: "DELETE" });
    toast.success("Alert removed");
    searches.mutate();
  };

  const criteria = (s: SavedSearch) =>
    [
      s.state,
      s.city,
      s.zip && `ZIP ${s.zip}`,
      s.property_type?.replace("_", " "),
      s.source,
      s.tier && `${s.tier}+`,
      s.min_price && `≥${money(s.min_price)}`,
      s.max_price && `≤${money(s.max_price)}`,
    ]
      .filter(Boolean)
      .join(" · ") || "Any matching deal";

  return (
    <div className="bg-transparent text-[var(--t1)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-[clamp(24px,4vw,36px)] font-black leading-tight">
          Alerts
        </h1>
        <p className="mt-1 text-[var(--t3)]">
          New hot &amp; warm leads matching your saved searches — they show up
          here the moment they land.
        </p>

        {unauth && (
          <div className="py-16 text-center">
            <p className="text-[var(--t2)] font-bold">
              Sign in to set and see alerts.
            </p>
            <Link
              href="/"
              className="inline-block mt-3 px-5 py-2.5 rounded-full font-bold text-black text-sm"
              style={{ background: ACCENT }}
            >
              Sign in
            </Link>
          </div>
        )}

        {!unauth && (
          <>
            {/* New matches */}
            <section className="mt-6">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-[var(--t4)] mb-3">
                New matches{matches.length ? ` · ${matches.length}` : ""}
              </h2>
              {matches.length === 0 ? (
                <div className="rounded-[var(--r3)] border border-dashed border-[var(--b1)] py-10 text-center text-sm text-[var(--t4)]">
                  No matches yet — set an alert from the{" "}
                  <Link
                    href="/homeiq/leads"
                    className="font-semibold"
                    style={{ color: ACCENT }}
                  >
                    leads
                  </Link>{" "}
                  page and new hot/warm deals will appear here.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {matches.map((m) => (
                    <Link
                      key={m.id}
                      href={`/homeiq/leads/${encodeURIComponent(m.id)}`}
                      className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] overflow-hidden hover:border-[var(--home-bd)] transition-colors"
                    >
                      <div className="relative h-32 bg-[var(--s2)]">
                        {m.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.image}
                            alt={m.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-[var(--t4)] text-xs">
                            No photo
                          </div>
                        )}
                        {m.score != null && (
                          <span
                            className="absolute top-2 left-2 text-xs font-black px-2 py-0.5 rounded text-white"
                            style={{
                              background:
                                TIER_COLOR[m.tier || ""] || "var(--blue)",
                            }}
                          >
                            {m.score}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="font-black text-[var(--t1)]">
                          {money(m.price)}
                          <span className="font-medium text-sm text-[var(--t3)]">
                            {m.city ? ` · ${m.city}, ${m.state || ""}` : ""}
                          </span>
                        </div>
                        <h3 className="text-sm text-[var(--t2)] truncate mt-0.5">
                          {m.title}
                        </h3>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Saved searches */}
            <section className="mt-8">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-[var(--t4)] mb-3">
                Saved searches{rows.length ? ` · ${rows.length}` : ""}
              </h2>
              {rows.length === 0 ? (
                <div className="rounded-[var(--r3)] border border-dashed border-[var(--b1)] py-8 text-center text-sm text-[var(--t4)]">
                  No saved searches. Filter the{" "}
                  <Link
                    href="/homeiq/leads"
                    className="font-semibold"
                    style={{ color: ACCENT }}
                  >
                    leads
                  </Link>{" "}
                  page and tap 🔔 Alert me to get notified of new matches.
                </div>
              ) : (
                <div className="space-y-2">
                  {rows.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--t1)] truncate">
                          {s.name}
                        </div>
                        <div className="text-[11px] text-[var(--t4)] truncate">
                          {criteria(s)}
                          {s.notify_email !== false ? " · 📧 email" : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(s.id)}
                        aria-label="Remove alert"
                        className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border border-[var(--b1)] text-[var(--t4)] hover:text-[var(--red)] hover:border-[var(--red)]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
