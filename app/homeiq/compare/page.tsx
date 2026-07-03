"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useCompare } from "@/hooks/useCompare";
import { aerialThumb } from "@/lib/housing/property-image";

// Side-by-side lead comparison — pick a few leads (compare toggle on the cards) and weigh them on one
// screen: price, condition, neighborhood, flood, distress, and the deal read. The modern "compare" pattern
// (real selected items), unlike the cars page's spec calculator.

const fetcher = async (key: string) => {
  const ids = key.replace("cmp:", "").split(",").filter(Boolean);
  const rows = await Promise.all(
    ids.map((id) =>
      fetch(`/api/homeiq/leads/${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((d) => d?.lead)
        .catch(() => null),
    ),
  );
  return rows;
};

const money = (n?: number | null) =>
  n != null ? `$${Math.round(n).toLocaleString()}` : "—";
const num = (n?: number | null) => (n != null ? n.toLocaleString() : "—");

export default function HomeComparePage() {
  const { items, clear, toggle } = useCompare("home");
  const key = items.length ? `cmp:${items.map((i) => i.id).join(",")}` : null;
  const { data, isLoading } = useSWR<any[]>(key, fetcher, {
    revalidateOnFocus: false,
  });
  const leads = (data || []).filter(Boolean);

  const ROWS: { label: string; get: (l: any) => ReactNode }[] = [
    { label: "Price", get: (l) => money(l.price) },
    {
      label: "Beds / Baths",
      get: (l) => `${l.beds ?? "—"} / ${l.baths ?? "—"}`,
    },
    { label: "Sqft", get: (l) => num(l.sqft) },
    {
      label: "$/sqft",
      get: (l) =>
        l.price && l.sqft ? money(Math.round(l.price / l.sqft)) : "—",
    },
    { label: "Type", get: (l) => (l.property_type || "—").replace(/_/g, " ") },
    {
      label: "Location",
      get: (l) => [l.city, l.state].filter(Boolean).join(", ") || "—",
    },
    {
      label: "Neighborhood",
      get: (l) => {
        // `neighborhood` can be a string OR an object {score, trajectory, label, ...} — render a string, never
        // the object (rendering the object throws React #31 and crashed this page in prod).
        const n = l.neighborhood;
        if (!n) return "—";
        const traj = typeof n === "string" ? n : n.trajectory || n.label || "";
        const label = typeof n === "string" ? n : n.label || n.trajectory || "";
        if (!label) return "—";
        return (
          <span
            style={{
              color: /ris|up|grow/i.test(traj)
                ? "var(--green)"
                : /declin|fall|down/i.test(traj)
                  ? "var(--red)"
                  : "var(--t3)",
            }}
          >
            {String(label)}
          </span>
        );
      },
    },
    {
      label: "Flood",
      get: (l) =>
        l.flood?.high ? (
          <span style={{ color: "var(--blue)" }}>⚠ {l.flood.zone}</span>
        ) : l.flood ? (
          "None"
        ) : (
          "—"
        ),
    },
    {
      label: "Distress",
      get: (l) => {
        const d = l.distress || {};
        const tags = [
          d.foreclosure && "Foreclosure",
          d.taxOwed && `Tax owed ${money(d.totalDue)}`,
          (d as any).vacant && "Vacant",
          d.outOfState && "Absentee",
        ].filter(Boolean);
        return tags.length ? tags.join(", ") : "—";
      },
    },
    {
      label: "Owner mailing",
      get: (l) => (l.ownerMailing ? "✅ direct-mail ready" : "—"),
    },
    {
      label: "Score / Tier",
      get: (l) => (
        <span className="font-black">
          {l.score ?? "—"}{" "}
          <span className="text-[11px] uppercase text-[var(--t4)]">
            {l.tier || ""}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div className="bg-transparent text-[var(--t1)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-[clamp(22px,4vw,32px)] font-black">
            Compare leads
          </h1>
          {leads.length > 0 && (
            <button
              onClick={() => clear()}
              className="text-xs font-bold px-3 py-1.5 rounded-full border border-[var(--b1)] text-[var(--t4)] hover:text-[var(--red)] hover:border-[var(--red)]"
            >
              Clear all
            </button>
          )}
        </div>

        {!key ? (
          <div className="rounded-[var(--r3)] border border-dashed border-[var(--b1)] py-16 text-center text-sm text-[var(--t4)]">
            Nothing to compare yet — tap the ⚖ compare toggle on any lead in the{" "}
            <Link
              href="/homeiq/leads"
              className="font-semibold text-[var(--home)]"
            >
              leads
            </Link>{" "}
            list.
          </div>
        ) : isLoading ? (
          <p className="text-sm text-[var(--t4)] py-10 text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[560px]">
              <thead>
                <tr>
                  <th className="w-28" />
                  {leads.map((l, i) => (
                    <th key={i} className="p-2 align-bottom text-left">
                      <Link
                        href={`/homeiq/leads/${encodeURIComponent(items[i]?.id)}`}
                        className="block"
                      >
                        <div className="h-24 rounded-[var(--r2)] overflow-hidden bg-[var(--s2)] mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              l.images?.[0] ||
                              l.image ||
                              aerialThumb(l.lat, l.lng, 300, 200) ||
                              undefined
                            }
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="font-bold text-[13px] text-[var(--t1)] leading-snug line-clamp-2">
                          {l.address || l.title || "Property"}
                        </div>
                      </Link>
                      <button
                        onClick={() => toggle(items[i]?.id)}
                        className="mt-1 text-[10px] font-bold text-[var(--t4)] hover:text-[var(--red)]"
                      >
                        Remove
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-[var(--b1)]">
                    <td className="p-2 text-[11px] font-black uppercase tracking-wider text-[var(--t4)] align-top">
                      {row.label}
                    </td>
                    {leads.map((l, i) => (
                      <td key={i} className="p-2 align-top text-[var(--t2)]">
                        {row.get(l)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
