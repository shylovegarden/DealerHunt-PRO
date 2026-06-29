// lib/housing/sources/redfin-county-ppsf.ts
//
// County-level real sold $/sqft from Redfin's free county_market_tracker (~241 MB gz). County medians vary
// HUGELY within a state (rural ~$120 vs metro ~$900), so a county anchor is far closer to true ARV than the
// state median. The file is too big to gunzip into one string (exceeds Node's max string length), so we
// STREAM it: download → gunzip stream → line-by-line. Keyed by normalized "county|ST" per property type.
//
// Data © Redfin (redfin.com/news/data-center) — free with attribution.

import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";

export const COUNTY_PPSF_URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/county_market_tracker.tsv000.gz";

const TYPE_ID_TO_KEY: Record<string, string> = {
  "-1": "all",
  "6": "single_family",
  "3": "condo",
  "4": "multi_family",
  "13": "townhouse",
};

export type PpsfByType = Record<string, number>;

function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"'))
    return t.slice(1, -1);
  return t;
}

/** Normalize a county name for matching across sources (lowercased, trailing ", ST" stripped). */
export function normalizeCounty(name: string): string {
  return name
    .replace(/,\s*[A-Za-z]{2}\s*$/, "")
    .trim()
    .toLowerCase();
}

/** Stable lookup key: "<normalized county>|<STATE>". */
export function countyKey(county: string, state: string): string {
  return `${normalizeCounty(county)}|${(state || "").toUpperCase()}`;
}

/**
 * Stream the Redfin county file into the latest median sale $/sqft per county+type. Node-only (streaming).
 * Keeps, for each (county|state, type), the most recent PERIOD_END row with a usable MEDIAN_PPSF.
 */
export async function fetchCountyPpsf(): Promise<Record<string, PpsfByType>> {
  const res = await fetch(COUNTY_PPSF_URL);
  if (!res.ok || !res.body)
    throw new Error(`Redfin county file: HTTP ${res.status}`);

  const gunzip = Readable.fromWeb(res.body as any).pipe(createGunzip());
  const rl = createInterface({ input: gunzip, crlfDelay: Infinity });

  let idx: {
    region: number;
    state: number;
    period: number;
    type: number;
    ppsf: number;
  } | null = null;
  const best: Record<
    string,
    Record<string, { period: string; psf: number }>
  > = {};

  for await (const line of rl) {
    if (!line) continue;
    if (!idx) {
      const h = line.split("\t").map((x) => unquote(x).toUpperCase());
      idx = {
        region: h.indexOf("REGION"),
        state: h.indexOf("STATE_CODE"),
        period: h.indexOf("PERIOD_END"),
        type: h.indexOf("PROPERTY_TYPE_ID"),
        ppsf: h.indexOf("MEDIAN_PPSF"),
      };
      if (Object.values(idx).some((i) => i < 0))
        throw new Error("[county-ppsf] expected columns not found");
      continue;
    }
    const f = line.split("\t");
    const typeKey = TYPE_ID_TO_KEY[unquote(f[idx.type] ?? "")];
    if (!typeKey) continue;
    const region = unquote(f[idx.region] ?? "");
    const state = unquote(f[idx.state] ?? "");
    if (!region || !state) continue;
    const ppsfRaw = unquote(f[idx.ppsf] ?? "");
    if (!ppsfRaw || ppsfRaw === "NA") continue;
    const psf = Math.round(Number(ppsfRaw));
    if (!Number.isFinite(psf) || psf <= 0) continue;
    const period = unquote(f[idx.period] ?? "");
    const key = countyKey(region, state);
    const cur = best[key]?.[typeKey];
    if (!cur || period > cur.period) {
      (best[key] ??= {})[typeKey] = { period, psf };
    }
  }

  const out: Record<string, PpsfByType> = {};
  for (const [key, byType] of Object.entries(best)) {
    out[key] = {};
    for (const [t, v] of Object.entries(byType)) out[key][t] = v.psf;
  }
  return out;
}
