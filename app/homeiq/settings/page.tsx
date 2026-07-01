"use client";

import Link from "next/link";
import { toast } from "sonner";
import { US_STATES, stateName } from "@/lib/housing/us-states";
import { usePreferences, type Prefs } from "@/hooks/usePreferences";

// HomeIQ settings — the "what do I want to see" controls that actually persist (user_preferences via
// /api/preferences). Default state lands you on your market every visit; you can still widen to Nearby /
// Nationwide on the leads page whenever you want more. Auto-saves on change (no lost edits).

const ACCENT = "var(--home)";
const STATE_CODES = Object.keys(US_STATES).sort((a, b) =>
  stateName(a).localeCompare(stateName(b)),
);

const TIERS = [
  { v: "", label: "All tiers" },
  { v: "hot", label: "🔥 Hot only" },
  { v: "warm", label: "Warm+" },
];
const TYPES = [
  { v: "", label: "Any type" },
  { v: "single_family", label: "Single-family" },
  { v: "multi_family", label: "Multi-family" },
  { v: "land", label: "Land" },
];
const VERTICALS = [
  { v: "homeiq", label: "🏠 HomeIQ (houses)" },
  { v: "cars", label: "🚗 DealerHunt (cars)" },
];

export default function HomeIQSettingsPage() {
  const { prefs, save, authed, isLoading } = usePreferences();

  const set = async (patch: Partial<Prefs>) => {
    await save(patch);
    toast.success("Saved");
  };

  const Row = ({
    label,
    hint,
    children,
  }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--b1)]">
      <div className="min-w-0">
        <div className="font-bold text-[var(--t1)]">{label}</div>
        {hint && (
          <div className="text-[12px] text-[var(--t4)] mt-0.5">{hint}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  const selectCls =
    "rounded-xl bg-[var(--s0)] border border-[var(--b1)] text-[var(--t1)] text-sm font-semibold px-3 py-2 min-w-[168px] focus:outline-none focus:border-[var(--home-bd)]";

  return (
    <div className="bg-transparent text-[var(--t1)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-[clamp(24px,4vw,36px)] font-black leading-tight">
          Settings
        </h1>
        <p className="mt-1 text-[var(--t3)]">
          Your defaults for what to see. Changes save instantly — you can still
          widen to Nearby or Nationwide on the leads page anytime.
        </p>

        {!authed && !isLoading ? (
          <div className="py-16 text-center">
            <p className="text-[var(--t2)] font-bold">
              Sign in to save your preferences.
            </p>
            <Link
              href="/"
              className="inline-block mt-3 px-5 py-2.5 rounded-full font-bold text-black text-sm"
              style={{ background: ACCENT }}
            >
              Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-6 rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] px-4 sm:px-5">
            <Row
              label="Default market"
              hint="The state your leads open to each visit."
            >
              <select
                className={selectCls}
                value={prefs.homeiqState || ""}
                onChange={(e) => set({ homeiqState: e.target.value })}
              >
                <option value="">Nationwide</option>
                {STATE_CODES.map((c) => (
                  <option key={c} value={c}>
                    {stateName(c)}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="Default tier" hint="Which lead quality to show first.">
              <select
                className={selectCls}
                value={prefs.homeiqTier || ""}
                onChange={(e) => set({ homeiqTier: e.target.value })}
              >
                {TIERS.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="Default property type">
              <select
                className={selectCls}
                value={prefs.homeiqType || ""}
                onChange={(e) => set({ homeiqType: e.target.value })}
              >
                {TYPES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="Land on" hint="Which app opens when you visit.">
              <select
                className={selectCls}
                value={prefs.preferredVertical || "homeiq"}
                onChange={(e) => set({ preferredVertical: e.target.value })}
              >
                {VERTICALS.map((v) => (
                  <option key={v.v} value={v.v}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Row>

            <div className="py-4 text-[12px] text-[var(--t4)]">
              Preferences are private to your account and sync across devices.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
