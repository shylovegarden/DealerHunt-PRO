"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { CalibrationCard } from "@/components/home/CalibrationCard";

// HomeIQ pipeline — the saved-leads board. Move a lead through the flip stages, jot notes, remove. Each
// saved row carries a snapshot so it survives even if the source listing is pruned.

const ACCENT = "var(--home)";
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
  notes?: string | null;
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
  // On mobile a 6-column board is a sideways-scrolling mess — show one stage at a time via a chip selector.
  const [mobileStage, setMobileStage] = useState("new");

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
  const saveNotes = async (id: string, notes: string) => {
    mutate(
      (rows as Saved[]).map((r) => (r.id === id ? { ...r, notes } : r)) as any,
      false,
    );
    await fetch(`/api/homeiq/saved/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    mutate();
  };

  // Record the realized profit on a closed deal — this is the label the future calibration model learns
  // from (which leads actually made money). Stored in the snapshot; mutate to reflect immediately.
  const recordOutcome = async (id: string, actualProfit: number) => {
    mutate(
      (rows as Saved[]).map((r) =>
        r.id === id
          ? {
              ...r,
              snapshot: { ...(r.snapshot || {}), outcome: { actualProfit } },
            }
          : r,
      ) as any,
      false,
    );
    await fetch(`/api/homeiq/saved/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: { actualProfit } }),
    });
    mutate();
  };

  return (
    <div className="bg-transparent text-[var(--t1)]">
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
          <>
            {/* The learning loop, made visible — calibrates the score against deals you actually close. */}
            <CalibrationCard />

            {/* Mobile: stage chip selector + a single full-width column. */}
            <div className="md:hidden">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                {STAGES.map((st) => {
                  const n = rows.filter((r) => r.status === st.key).length;
                  const active = mobileStage === st.key;
                  return (
                    <button
                      key={st.key}
                      onClick={() => setMobileStage(st.key)}
                      className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border"
                      style={{
                        background: active ? ACCENT : "var(--s2)",
                        color: active ? "#000" : "var(--t3)",
                        borderColor: active ? ACCENT : "var(--b1)",
                      }}
                    >
                      {st.label} <span style={{ opacity: 0.7 }}>{n}</span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2 mt-3">
                {rows
                  .filter((r) => r.status === mobileStage)
                  .map((r) => (
                    <Card
                      key={r.id}
                      row={r}
                      onMove={move}
                      onRemove={remove}
                      onNotes={saveNotes}
                      onOutcome={recordOutcome}
                    />
                  ))}
                {rows.filter((r) => r.status === mobileStage).length === 0 && (
                  <div className="rounded-[var(--r3)] border border-dashed border-[var(--b1)] py-10 text-center text-xs text-[var(--t4)]">
                    Nothing in this stage yet.
                  </div>
                )}
              </div>
            </div>

            {/* Desktop: the full kanban board. */}
            <div className="hidden md:flex gap-3 overflow-x-auto pb-4">
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
                          onNotes={saveNotes}
                          onOutcome={recordOutcome}
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
          </>
        )}
      </div>
    </div>
  );
}

function Card({
  row,
  onMove,
  onRemove,
  onNotes,
  onOutcome,
}: {
  row: Saved;
  onMove: (id: string, s: string) => void;
  onRemove: (id: string) => void;
  onNotes: (id: string, notes: string) => void;
  onOutcome: (id: string, profit: number) => void;
}) {
  const s = row.snapshot || {};
  const color = TIER_COLOR[s.lead_tier] || "var(--blue)";
  const [note, setNote] = useState(row.notes ?? "");
  const [profit, setProfit] = useState(
    s.outcome?.actualProfit != null ? String(s.outcome.actualProfit) : "",
  );
  const commitProfit = () => {
    const v = Number(profit.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(v) && v !== (s.outcome?.actualProfit ?? NaN))
      onOutcome(row.id, Math.round(v));
  };
  const commitNote = () => {
    const trimmed = note.trim();
    if (trimmed !== (row.notes ?? "")) onNotes(row.id, trimmed);
  };
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
        {s.owner && (
          <div className="text-[11px] text-[var(--t3)] truncate mt-0.5">
            👤 <span className="font-semibold">{s.owner}</span>
            {s.ownerMailing && (
              <span className="text-[var(--green)]"> · 📮</span>
            )}
            {s.ownerCount >= 5 && (
              <span className="text-[var(--t1)] font-bold">
                {" "}
                · 🏢 {s.ownerCount.toLocaleString()}
              </span>
            )}
          </div>
        )}
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
          aria-label="Remove from pipeline"
          className="shrink-0 w-7 h-7 grid place-items-center rounded-[var(--r2)] text-[var(--t4)] hover:text-[var(--red)] hover:bg-[var(--s2)]"
        >
          ✕
        </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={commitNote}
        placeholder="Notes — phone, offer, follow-up…"
        rows={note ? 2 : 1}
        className="mt-2 w-full text-[11px] px-2 py-1 rounded-[var(--r2)] bg-[var(--s2)] border border-[var(--b1)] text-[var(--t2)] placeholder:text-[var(--t4)] resize-none focus:outline-none focus:border-[var(--t4)]"
      />
      {/* Closed-deal outcome — feeds the learning loop (which leads actually made money). */}
      {row.status === "closed" && (
        <label className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--t3)]">
          Actual profit $
          <input
            inputMode="numeric"
            value={profit}
            onChange={(e) => setProfit(e.target.value)}
            onBlur={commitProfit}
            placeholder="e.g. 28500"
            className="flex-1 w-full px-2 py-1 rounded-[var(--r2)] bg-[var(--s2)] border border-[var(--b1)] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:border-[var(--green)]"
            style={{ borderColor: profit ? "var(--green)" : undefined }}
          />
        </label>
      )}
    </div>
  );
}
