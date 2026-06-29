// lib/housing/sources/open-data-sources.ts
//
// The CONFIG REGISTRY for nationwide off-market lead coverage — each entry is one city/county open-data
// feed mapped onto the generic engine in open-data.ts. Adding a jurisdiction = add a config here. Starting
// Missouri-first (St. Louis + Kansas City metros), then expanding across the state and the US. Every map
// emits the distress `signals` the lead scorer already ranks (vacant / code_violation / tax_delinquent /
// absentee / land_bank).

import type { Property } from "../types";
import { fetchOpenDataSources, type OpenDataSource } from "./open-data";

const s = (v: unknown) =>
  v == null ? undefined : String(v).trim() || undefined;
const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : undefined;
};
// Socrata GeoJSON point column → {lat,lng} ([lng,lat] order).
function pointLatLng(geo: any): { lat?: number; lng?: number } {
  const c = geo?.coordinates;
  if (Array.isArray(c) && c.length >= 2)
    return { lng: Number(c[0]), lat: Number(c[1]) };
  return {};
}

// ── MISSOURI ──────────────────────────────────────────────────────────────
export const MISSOURI_SOURCES: OpenDataSource[] = [
  {
    // Kansas City "Dangerous Buildings" — open structural-danger cases = vacant/severe distress.
    source: "dangerous_building",
    api: "socrata",
    url: "https://data.kcmo.org/resource/ax3m-jhxx.json",
    state: "MO",
    city: "Kansas City",
    where: "statusofcase = 'Ongoing Case'",
    limit: 3000,
    map: (a): Property | null => {
      const address = s(a.address);
      if (!address) return null;
      const { lat, lng } = pointLatLng(a.case_location);
      return {
        source: "dangerous_building",
        source_listing_id: `kcmo-db-${a.pin || a.casenumber}`,
        title: `Dangerous building · ${address}`,
        address,
        city: "Kansas City",
        state: "MO",
        zip: s(a.zip_code),
        lat,
        lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          vacant: true,
          dangerous: true,
          violation_count: 1,
          status: "Dangerous building",
        },
      };
    },
  },
];

// All configured open-data jurisdictions (grows state by state).
export const OPEN_DATA_SOURCES: OpenDataSource[] = [...MISSOURI_SOURCES];

/** Harvest all configured open-data off-market leads (Missouri-first; whole-US as configs are added). */
export function fetchOpenDataLeads(
  sources: OpenDataSource[] = OPEN_DATA_SOURCES,
): Promise<Property[]> {
  return fetchOpenDataSources(sources);
}
