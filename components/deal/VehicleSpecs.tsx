"use client";

import React from "react";
import useSWR from "swr";
import { isValidVin } from "@/lib/vehicle/vin";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Authoritative free vehicle specs + open recalls (NHTSA), keyed off the deal's VIN. Hides if no VIN. */
export function VehicleSpecs({ vin }: { vin?: string | null }) {
  const valid = vin && isValidVin(vin);
  const { data } = useSWR(valid ? `/api/vin/${vin}/specs` : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 600_000,
  });
  if (!valid || !data || data.error) return null;

  const specs = [
    { label: "Body", value: data.bodyClass },
    {
      label: "Engine",
      value:
        data.displacementL || data.cylinders
          ? `${data.displacementL ? `${data.displacementL}L` : ""}${data.cylinders ? ` ${data.cylinders}-cyl` : ""}`.trim()
          : null,
    },
    { label: "Drivetrain", value: data.driveType },
    { label: "Fuel", value: data.fuelType },
    { label: "Trim", value: data.trim },
    {
      label: "Assembly",
      value: data.plantCountry
        ? `${data.plantCountry}${data.madeInUsa ? " 🇺🇸" : ""}`
        : null,
    },
  ].filter((s) => s.value);

  if (specs.length === 0 && data.recalls == null) return null;

  return (
    <div className="glass-panel p-5 mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--t4)] font-bold">
          Vehicle specs · NHTSA verified
        </p>
        {data.recalls != null && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={
              data.recalls > 0
                ? { background: "var(--amber-lo)", color: "var(--amber-d)" }
                : { background: "var(--glo)", color: "var(--green)" }
            }
            title="Open NHTSA recall campaigns for this make/model/year"
          >
            {data.recalls > 0
              ? `⚠ ${data.recalls} open recall${data.recalls === 1 ? "" : "s"}`
              : "✓ No open recalls"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {specs.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] text-[var(--t4)] font-semibold uppercase tracking-wide">
              {s.label}
            </p>
            <p className="text-sm text-[var(--t1)] font-medium capitalize-first">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {data.recalls > 0 && (
        <p className="text-[11px] text-[var(--t4)]">
          Open recalls are free negotiation leverage — and the dealer can have
          them fixed at no cost before resale.
        </p>
      )}
    </div>
  );
}
