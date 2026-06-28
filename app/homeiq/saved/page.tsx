"use client";

import useSWR from "swr";
import Link from "next/link";

// HomeIQ pipeline — the saved-leads board. Move a lead through the flip stages, jot notes, remove. Each
// saved row carries a snapshot so it survives even if the source listing is pruned.

const ACCENT = "#2dd4bf";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

const STAGES: { key: string; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "analyzing", label: "Analyzing" },
  { key: "offer", label: "Offer sent" },
  { key: "contract", label: "Under contract" },
  { key: "closed", label: "Closed" },
];
const TIER_COLOR: Record<string, string> = {
  hot: "var(--red)",
  warm: "var(--amber)",
  standard: "var(--blue)",
};

interface Saved {
  id: string;
  property_listing_id: string;
  status: string;
  snapshot: any;
}

export default function SavedPipelinePage() {
  const { data, mutate, isLoading } = useSWR<Saved[] | { error: string }>(
    "/api/homeiq/saved",
    fetcher,
    { revalidateOnFocus: false },
  );
  const unauth = !Array.isArray(data) && (data as any)?.error;
  const rows: Saved[] = Array.isArray(data) ? data : [];

  const move = async (id: string, status: string) => {
    mutate(
      (rows as Saved[]).map((r) => (r.id === id ? { ...r, status } : r)) as any,
      false,
    );
    await fetch(`/api/homeiq/saved/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    mutate();
  };
  const remove = async (id: string) => {
    mutate((rows as Saved[]).filter((r) => r.id !== id) as any, false);
    await fetch(`/api/homeiq/saved/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <main className="min-h-screen bg-[var(--s1)] text-[var(--t1)]">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
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
            Pipeline
          </span>
        </div>
        <Link
          href="/homeiq/leads"
          className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
        >
          ← Leads
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {isLoading && (
          <p className="text-[var(--t4)] text-sm py-10 text-center">
            Loading pipeline…
          </p>
        )}
        {unauth && (
          <div className="py-16 text-center">
            <p className="text-[var(--t2)] font-bold">
              Sign in to save and track leads.
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
        {!isLoading && !unauth && rows.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[var(--t2)] font-bold">No saved leads yet.</p>
            <Link
              href="/homeiq/leads"
              className="inline-block mt-3 text-sm font-semibold"
              style={{ color: ACCENT }}
            >
              Browse leads → save the good ones
            </Link>
          </div>
        )}
        {!isLoading && !unauth && rows.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map((st) => {
              const col = rows.filter((r) => r.status === st.key);
              return (
                <div key={st.key} className="min-w-[260px] flex-1">
                  <div className="text-xs font-black uppercase tracking-widest text-[var(--t4)] mb-2 px-1 flex items-center justify-between">
                    <span>{st.label}</span>
                    <span>{col.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.map((r) => (
                      <Card
                        key={r.id}
                        row={r}
                        onMove={move}
                        onRemove={remove}
                      />
                    ))}
                    {col.length === 0 && (
                      <div className="rounded-[var(--r3)] border border-dashed border-[var(--b1)] py-6 text-center text-[11px] text-[var(--t4)]">
                        —
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Card({
  row,
  onMove,
  onRemove,
}: {
  row: Saved;
  onMove: (id: string, s: string) => void;
  onRemove: (id: string) => void;
}) {
  const s = row.snapshot || {};
  const color = TIER_COLOR[s.lead_tier] || "var(--blue)";
  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-3">
      <Link
        href={`/homeiq/leads/${encodeURIComponent(row.property_listing_id)}`}
        className="block"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-black text-[var(--t1)] text-sm">
            ${(s.price || 0).toLocaleString()}
          </span>
          {s.lead_score != null && (
            <span
              className="text-[11px] font-black px-1.5 py-0.5 rounded text-white"
              style={{ background: color }}
            >
              {s.lead_score}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--t3)] truncate mt-0.5">
          {s.city ? `${s.city}, ${s.state || ""}` : s.state || ""}
        </div>
        <div className="text-xs text-[var(--t2)] truncate">{s.title}</div>
        {s.mao != null && (
          <div className="text-[11px] font-bold mt-1" style={{ color: ACCENT }}>
            MAO ${s.mao.toLocaleString()} · {s.verdict}
          </div>
        )}
      </Link>
      <div className="flex items-center gap-2 mt-2">
        <select
          value={row.status}
          onChange={(e) => onMove(row.id, e.target.value)}
          className="flex-1 text-[11px] font-bold px-2 py-1 rounded-[var(--r2)] bg-[var(--s2)] border border-[var(--b1)] text-[var(--t2)] cursor-pointer"
        >
          {STAGES.map((st) => (
            <option key={st.key} value={st.key}>
              {st.label}
            </option>
          ))}
          <option value="dead">Dead</option>
        </select>
        <button
          onClick={() => onRemove(row.id)}
          className="text-[11px] text-[var(--t4)] hover:text-[var(--red)] px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
