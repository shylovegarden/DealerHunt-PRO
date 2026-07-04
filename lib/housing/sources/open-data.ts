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
  api: "socrata" | "arcgis" | "ckan";
  /** Socrata: https://<domain>/resource/<id>.json · ArcGIS: <service>/FeatureServer/<n> (or MapServer) ·
   *  CKAN: the portal base, e.g. https://data.wprdc.org (+ `resourceId`). */
  url: string;
  /** CKAN only — the datastore resource id used in datastore_search_sql. */
  resourceId?: string;
  state: string;
  city?: string;
  /** Socrata SoQL `$where` / ArcGIS `where` filter. */
  where?: string;
  /** Total rows to pull (paged under the hood). */
  limit?: number;
  /** ArcGIS paging strategy: "offset" (default) or "oid" for layers that reject resultOffset (some
   *  Tyler/iasWorld county services) — those need returnIdsOnly + OBJECTID-IN batching. */
  paging?: "offset" | "oid";
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

// Map an ArcGIS feature list through the source's `map`, extracting lon/lat geometry.
function mapArcgisFeatures(
  feats: { attributes: Record<string, any>; geometry?: any }[],
  cfg: OpenDataSource,
): Property[] {
  const out: Property[] = [];
  for (const f of feats) {
    const g: any = f.geometry || {};
    let lng = Number(g.x ?? g.longitude);
    let lat = Number(g.y ?? g.latitude);
    // Polygon parcel layers return `rings` — derive a centroid from the first ring's vertices.
    if (
      (!Number.isFinite(lat) || !Number.isFinite(lng)) &&
      Array.isArray(g.rings?.[0])
    ) {
      const ring = g.rings[0] as number[][];
      let sx = 0,
        sy = 0;
      for (const [x, y] of ring) {
        sx += x;
        sy += y;
      }
      lng = sx / ring.length;
      lat = sy / ring.length;
    }
    const p = cfg.map(f.attributes || {}, {
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    });
    if (p) out.push(p);
  }
  return out;
}

// For layers that reject resultOffset: pull the matching OBJECTIDs, then fetch attributes in IN() batches.
async function fetchArcGISByOID(cfg: OpenDataSource): Promise<Property[]> {
  const cap = Math.min(cfg.limit ?? 2000, 50000);
  const idParams = new URLSearchParams({
    where: cfg.where || "1=1",
    returnIdsOnly: "true",
    f: "json",
  });
  const idRes = await fetch(`${cfg.url}/query?${idParams.toString()}`);
  if (!idRes.ok) return [];
  const idJson = (await idRes.json()) as {
    objectIdFieldName?: string;
    objectIds?: number[];
  };
  const oidField = idJson.objectIdFieldName || "OBJECTID";
  const ids = (idJson.objectIds || []).slice(0, cap);
  if (!ids.length) return [];

  const out: Property[] = [];
  const BATCH = 200;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const params = new URLSearchParams({
      where: `${oidField} IN (${batch.join(",")})`,
      outFields: "*",
      f: "json",
      outSR: "4326",
      returnGeometry: "true",
    });
    const res = await fetch(`${cfg.url}/query?${params.toString()}`);
    if (!res.ok) continue;
    const json = (await res.json()) as {
      features?: { attributes: Record<string, any>; geometry?: any }[];
    };
    out.push(...mapArcgisFeatures(json.features || [], cfg));
  }
  return out;
}

async function fetchArcGIS(cfg: OpenDataSource): Promise<Property[]> {
  if (cfg.paging === "oid") return fetchArcGISByOID(cfg);
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
    out.push(...mapArcgisFeatures(feats, cfg));
    if (feats.length < take) break;
  }
  return out;
}

// CKAN datastore (WPRDC, data.boston.gov, etc.) — SQL over a resource id. No geometry in most tables →
// lat/lng come from row columns when present, else the address is geocoded on upsert.
async function fetchCKAN(cfg: OpenDataSource): Promise<Property[]> {
  const cap = Math.min(cfg.limit ?? 2000, 50000);
  const out: Property[] = [];
  for (let off = 0; off < cap; off += PAGE) {
    const take = Math.min(PAGE, cap - off);
    const sql = `SELECT * FROM "${cfg.resourceId}"${cfg.where ? ` WHERE ${cfg.where}` : ""} LIMIT ${take} OFFSET ${off}`;
    const res = await fetch(
      `${cfg.url}/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`,
    );
    if (!res.ok) break;
    const json = (await res.json()) as {
      result?: { records?: Record<string, any>[] };
    };
    const rows = json?.result?.records;
    if (!Array.isArray(rows) || !rows.length) break;
    for (const r of rows) {
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

/** Fetch + normalize a configured open-data source. Returns [] on failure (harvest degrades gracefully). */
export async function fetchOpenData(cfg: OpenDataSource): Promise<Property[]> {
  try {
    if (cfg.api === "socrata") return await fetchSocrata(cfg);
    if (cfg.api === "ckan") return await fetchCKAN(cfg);
    return await fetchArcGIS(cfg);
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
