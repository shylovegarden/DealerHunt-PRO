"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { US_STATES, stateName, nearestState } from "@/lib/housing/us-states";
import { usePreferences } from "@/hooks/usePreferences";

// "My States" — the location-aware, multi-state curation control. Apple-clean sheet, Netflix-informative
// (every state shows its live inventory count so you pick where there's actually something to see). Detects
// your location, pins it, and lets you add as many states as you want. Saves to carsStates / homeiqStates;
// the feeds/discover then scope to exactly these — no unrelated states.

const ALL_CODES = Object.keys(US_STATES).sort((a, b) =>
  stateName(a).localeCompare(stateName(b)),
);

export function StatePicker({
  vertical,
  open,
  onClose,
  onSaved,
}: {
  vertical: "cars" | "homes";
  open: boolean;
  onClose: () => void;
  onSaved?: (states: string[]) => void;
}) {
  const { prefs, save } = usePreferences();
  const key = vertical === "homes" ? "homeiqStates" : "carsStates";
  const accent = vertical === "homes" ? "var(--grad-home)" : "var(--grad)";
  const noun = vertical === "homes" ? "homes" : "cars";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [detected, setDetected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  // Seed selection from saved prefs + load live counts each open.
  useEffect(() => {
    if (!open) return;
    setSelected(new Set(((prefs as any)[key] as string[]) || []));
    setQuery("");
    fetch(`/api/state-counts?vertical=${vertical}`)
      .then((r) => r.json())
      .then((d) => setCounts(d.counts || {}))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vertical]);

  const detect = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Location isn’t available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const code = nearestState(pos.coords.latitude, pos.coords.longitude);
        if (code) {
          setDetected(code);
          setSelected((s) => new Set(s).add(code));
          toast.success(`📍 ${stateName(code)} added`);
        }
      },
      () => toast.error("Couldn’t get your location"),
      { timeout: 8000 },
    );
  };

  const toggle = (code: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });

  // Sort: selected first, then by live inventory (most to see up top), then alphabetical.
  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_CODES.filter(
      (c) =>
        !q || stateName(c).toLowerCase().includes(q) || c.toLowerCase() === q,
    ).sort((a, b) => {
      const sa = selected.has(a) ? 1 : 0;
      const sb = selected.has(b) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      const ca = counts[a] || 0;
      const cb = counts[b] || 0;
      if (ca !== cb) return cb - ca;
      return stateName(a).localeCompare(stateName(b));
    });
  }, [query, selected, counts]);

  const done = async () => {
    setBusy(true);
    try {
      const states = Array.from(selected);
      await save({ [key]: states } as any);
      onSaved?.(states);
      toast.success(
        states.length
          ? `Showing ${noun} in ${states.length} state${states.length > 1 ? "s" : ""}`
          : `Showing ${noun} everywhere`,
      );
      onClose();
    } catch {
      toast.error("Couldn’t save");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[var(--b1)] bg-[var(--s0)] shadow-2xl sm:rounded-3xl animate-popIn">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h2 className="serif text-2xl font-bold text-[var(--t1)]">
              Your states
            </h2>
            <p className="mt-1 text-sm text-[var(--t4)]">
              Only see {noun} where you want them. Add as many as you like.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[var(--t4)] hover:bg-[var(--s2)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 px-6 pt-4">
          <button
            onClick={detect}
            className="shrink-0 rounded-full border border-[var(--b1)] px-3.5 py-2 text-sm font-bold text-[var(--t2)] hover:bg-[var(--s2)]"
          >
            📍 Use my location
          </button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search states"
            className="min-w-0 flex-1 rounded-full border border-[var(--b1)] bg-[var(--s1)] px-4 py-2 text-sm text-[var(--t1)] outline-none focus:border-[var(--brand)]"
          />
        </div>

        {/* Grid */}
        <div className="mt-4 flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ordered.map((code) => {
              const on = selected.has(code);
              const n = counts[code] || 0;
              return (
                <button
                  key={code}
                  onClick={() => toggle(code)}
                  className="relative flex flex-col items-start gap-0.5 rounded-2xl border p-3 text-left transition-all"
                  style={{
                    borderColor: on ? "transparent" : "var(--b1)",
                    background: on ? accent : "var(--s1)",
                    color: on ? "#fff" : "var(--t1)",
                  }}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate text-sm font-bold">
                      {stateName(code)}
                    </span>
                    {detected === code && (
                      <span className="text-[11px]" title="Your location">
                        📍
                      </span>
                    )}
                    {on && detected !== code && (
                      <span className="text-sm">✓</span>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-semibold"
                    style={{
                      color: on ? "rgba(255,255,255,0.85)" : "var(--t4)",
                    }}
                  >
                    {n > 0 ? `${n.toLocaleString()} ${noun}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--b1)] px-6 py-4">
          <span className="text-sm font-semibold text-[var(--t4)]">
            {selected.size === 0 ? "Everywhere" : `${selected.size} selected`}
          </span>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="rounded-full px-4 py-2.5 text-sm font-bold text-[var(--t4)] hover:bg-[var(--s2)]"
              >
                Clear
              </button>
            )}
            <button
              onClick={done}
              disabled={busy}
              className="rounded-full px-7 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: accent }}
            >
              {busy ? "Saving…" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
