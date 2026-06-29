// lib/housing/sources/open-data.ts
//
// Generic connectors for the two formats that ~every US city/county open-data portal uses — Socrata and
// ArcGIS REST — so adding a new jurisdiction is CONFIG, not code. Each source supplies a field `map` that
// turns a raw row/feature into a HomeIQ Property (with distress `signals` the lead scorer already reads:
// tax_delinquent, code_violation, vacant, absentee, land_bank…). Both paginate past the portal page caps
// (Socrata $limit/$offset; ArcGIS maxRecordCount via resultOffset) — the same cap discipline as the rest
// of the app. No auth. Built to seed Missouri end-to-end, then roll out the whole US.

import type { Property } from "../types";

export interface OpenDataSource {
  /** Our canonical source key, e.g. "stl_lra", "kc_dangerous". */
  source: string;
  api: "socrata" | "arcgis";
  /** Socrata: https://<domain>/resource/<id>.json · ArcGIS: <service>/FeatureServer/<n> (or MapServer). */
  url: string;
  state: string;
  city?: string;
  /** Socrata SoQL `$where` / ArcGIS `where` filter. */
  where?: string;
  /** Total rows to pull (paged under the hood). */
  limit?: number;
  /** Map one raw row/feature → a Property (return null to skip). `attrs` is the row (Socrata) or
   *  feature.attributes (ArcGIS); `geom` is {lat,lng} when available. */
  map: (
    attrs: Record<string, any>,
    geom: { lat?: number; lng?: number },
  ) => Property | null;
}

const PAGE = 1000;

async function fetchSocrata(cfg: OpenDataSource): Promise<Property[]> {
  const cap = Math.min(cfg.limit ?? 2000, 50000);
  const out: Property[] = [];
  for (let off = 0; off < cap; off += PAGE) {
    const take = Math.min(PAGE, cap - off);
    const params = new URLSearchParams({
      $limit: String(take),
      $offset: String(off),
    });
    if (cfg.where) params.set("$where", cfg.where);
    const res = await fetch(`${cfg.url}?${params.toString()}`);
    if (!res.ok) break;
    const rows = (await res.json()) as Record<string, any>[];
    if (!Array.isArray(rows) || !rows.length) break;
    for (const r of rows) {
      // Socrata point columns arrive as {latitude, longitude} or a gekey {coordinates:[lng,lat]}.
      const lat = Number(r.latitude ?? r.lat);
      const lng = Number(r.longitude ?? r.lng);
      const p = cfg.map(r, {
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
      });
      if (p) out.push(p);
    }
    if (rows.length < take) break;
  }
  return out;
}

async function fetchArcGIS(cfg: OpenDataSource): Promise<Property[]> {
  const cap = Math.min(cfg.limit ?? 2000, 50000);
  const out: Property[] = [];
  for (let off = 0; off < cap; off += PAGE) {
    const take = Math.min(PAGE, cap - off);
    const params = new URLSearchParams({
      where: cfg.where || "1=1",
      outFields: "*",
      f: "json",
      outSR: "4326", // geometry back as lon/lat
      resultOffset: String(off),
      resultRecordCount: String(take),
      returnGeometry: "true",
    });
    const res = await fetch(`${cfg.url}/query?${params.toString()}`);
    if (!res.ok) break;
    const json = (await res.json()) as {
      features?: { attributes: Record<string, any>; geometry?: any }[];
      error?: unknown;
    };
    const feats = json.features;
    if (!Array.isArray(feats) || !feats.length) break;
    for (const f of feats) {
      const g = f.geometry || {};
      const lng = Number(g.x ?? g.longitude);
      const lat = Number(g.y ?? g.latitude);
      const p = cfg.map(f.attributes || {}, {
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
      });
      if (p) out.push(p);
    }
    if (feats.length < take) break;
  }
  return out;
}

/** Fetch + normalize a configured open-data source. Returns [] on failure (harvest degrades gracefully). */
export async function fetchOpenData(cfg: OpenDataSource): Promise<Property[]> {
  try {
    return cfg.api === "socrata"
      ? await fetchSocrata(cfg)
      : await fetchArcGIS(cfg);
  } catch {
    return [];
  }
}

/** Run several open-data sources concurrently and flatten (each already degrades to [] on failure). */
export async function fetchOpenDataSources(
  cfgs: OpenDataSource[],
): Promise<Property[]> {
  const results = await Promise.all(cfgs.map((c) => fetchOpenData(c)));
  return results.flat();
}
