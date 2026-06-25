"use client";

import React from "react";
import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Ico } from "@/components/shared/Ico";
import {
  historyFromText,
  type VinHistory as VinHistoryT,
} from "@/lib/vehicle/vin-history";

// VIN history — the "should I buy" red flags. Tier 1 (free) from the listing text shows instantly;
// if an NMVTIS key is configured, the authoritative report upgrades it. Always shows something.
const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function VinHistory({
  vin,
  title,
  condition,
  damageType,
}: {
  vin?: string | null;
  title?: string | null;
  condition?: string | null;
  damageType?: string | null;
}) {
  // Tier 1 — instant, free, from text we already have.
  const local = React.useMemo(
    () => historyFromText({ title, condition, damageType }),
    [title, condition, damageType],
  );
  // Tier 2 — authoritative upgrade when a VIN + NMVTIS key exist (else returns non-authoritative).
  const { data } = useSWR(
    vin && vin.length === 17 ? `/api/vin/${vin}/history` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const h: VinHistoryT =
    data && data.authoritative ? (data as VinHistoryT) : local;

  const hasFlags = h.titleBrands.length > 0;
  // Show only when we have something meaningful (flags, claims, or an authoritative all-clear).
  if (!hasFlags && h.cleanClaims.length === 0 && !h.authoritative) return null;

  return (
    <Card
      className="border-none"
      style={{ background: "var(--s0)", boxShadow: "var(--shadow)" }}
    >
      <div
        className="h-1 w-full"
        style={{ background: hasFlags ? "var(--red)" : "var(--green)" }}
      />
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--t4)] font-bold">
            VIN history
          </p>
          <span className="text-[10px] text-[var(--t5)]">
            {h.authoritative ? "NMVTIS · verified" : "from listing · claimed"}
          </span>
        </div>

        {hasFlags ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {h.titleBrands.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-2.5 py-1 rounded-md"
                style={{ background: "var(--red)" }}
              >
                <Ico name="alert-triangle" size={13} />
                {b}
              </span>
            ))}
          </div>
        ) : (
          <div
            className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-md mb-3"
            style={{ background: "var(--glo)", color: "var(--green)" }}
          >
            <Ico name="check-circle" size={15} />
            {h.authoritative
              ? "No title brands on record"
              : "No red flags disclosed"}
          </div>
        )}

        {h.cleanClaims.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
            {h.cleanClaims.map((c) => (
              <span key={c} className="text-xs text-[var(--t3)] font-semibold">
                ✓ {c}
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-[var(--t4)] leading-relaxed">{h.note}</p>
      </CardContent>
    </Card>
  );
}
