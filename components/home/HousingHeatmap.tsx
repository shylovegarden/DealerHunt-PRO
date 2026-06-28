"use client";

import React from "react";
import Link from "next/link";
import { ACCENT } from "@/components/home/HousingCharts";

// US opportunity heatmap for HomeIQ — a recognizable state-tile grid colored by how many scored leads
// each state holds, with hot-lead emphasis. The whole-country view at a glance: where the distressed
// inventory clusters. Each tile links into that state's filtered lead feed. Mirrors the cars-side
// USHeatmap layout/pattern (no new deps, no new server route — byState/byStateHot come from the page).

// prettier-ignore
const GRID: string[][] = [
  ["AK","" ,"" ,"" ,"" ,"" ,"" ,"" ,"" ,"" ,"ME"],
  ["" ,"" ,"" ,"" ,"" ,"" ,"" ,"" ,"" ,"VT","NH"],
  ["WA","ID","MT","ND","MN","WI","" ,"MI","" ,"NY","MA"],
  ["OR","NV","WY","SD","IA","IL","IN","OH","PA","NJ","RI"],
  ["CA","UT","CO","NE","MO","KY","WV","VA","MD","CT","" ],
  ["" ,"AZ","NM","KS","AR","TN","NC","SC","DC","DE","" ],
  ["" ,"" ,"" ,"OK","LA","MS","AL","GA","" ,"" ,"" ],
  ["HI","" ,"TX","" ,"" ,"" ,"" ,"FL","" ,"" ,"" ],
];

export function HousingHeatmap({
  byState,
  byStateHot = {},
}: {
  byState: Record<string, number>;
  byStateHot?: Record<string, number>;
}) {
  const maxN = Math.max(...Object.values(byState), 1);
  const totalStates = Object.values(byState).filter((n) => n > 0).length;

  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--t4)]">
          Opportunity heatmap · {totalStates} markets
        </h3>
        <span className="text-[10px] text-[var(--t5)]">
          click a state to drill in
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {GRID.map((row, ri) => (
          <div key={ri} className="flex gap-1">
            {row.map((st, ci) => {
              if (!st)
                return <div key={ci} className="h-9 flex-1" aria-hidden />;
              const n = byState[st] || 0;
              const hot = byStateHot[st] || 0;
              const intensity = n ? 0.16 + 0.84 * (n / maxN) : 0;
              const tile = (
                <div
                  className="h-9 flex-1 rounded-[6px] grid place-items-center relative border transition-all"
                  style={{
                    background: n
                      ? `color-mix(in srgb, ${ACCENT} ${Math.round(intensity * 100)}%, var(--s2))`
                      : "var(--s2)",
                    borderColor: hot ? "var(--red)" : "transparent",
                    opacity: n ? 1 : 0.45,
                  }}
                  title={
                    n
                      ? `${st}: ${n} leads${hot ? ` · ${hot} hot` : ""}`
                      : `${st}: no leads`
                  }
                >
                  <span
                    className="text-[10px] font-black leading-none"
                    style={{
                      color: intensity > 0.5 ? "#06201d" : "var(--t2)",
                    }}
                  >
                    {st}
                  </span>
                  {n > 0 && (
                    <span
                      className="text-[8px] font-bold leading-none mt-px"
                      style={{
                        color: intensity > 0.5 ? "#06201dcc" : "var(--t4)",
                      }}
                    >
                      {n}
                    </span>
                  )}
                </div>
              );
              return n > 0 ? (
                <Link
                  key={ci}
                  href={`/homeiq/leads?state=${st}`}
                  className="flex-1 flex hover:scale-[1.06] transition-transform"
                >
                  {tile}
                </Link>
              ) : (
                <React.Fragment key={ci}>{tile}</React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[9px] text-[var(--t5)]">
        <span>fewer</span>
        <div
          className="flex-1 h-1.5 rounded-full max-w-[160px]"
          style={{
            background: `linear-gradient(90deg, var(--s2), ${ACCENT})`,
          }}
        />
        <span>more</span>
        <span className="ml-3 inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm border border-[var(--red)]" />
          has hot leads
        </span>
      </div>
    </div>
  );
}
