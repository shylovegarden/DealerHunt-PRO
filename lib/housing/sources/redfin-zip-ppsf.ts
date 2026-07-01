// lib/housing/sources/redfin-zip-ppsf.ts
//
// ZIP-level real sold $/sqft from Redfin's free zip_code_market_tracker (~hundreds of MB gz). A ZIP median
// is the most precise free comp anchor we have — even within one county, $/sqft swings street-to-street, and
// a ZIP median captures that far better than a county median. This is the top tier of the ARV ladder
// (zip → county → state). Same streaming approach as the county feed (the file exceeds Node's max string
// length, so we gunzip-stream line-by-line). Keyed by 5-digit ZIP per property type.
//
// Data © Redfin (redfin.com/news/data-center) — free with attribution.

import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import type { PpsfByType } from "./redfin-county-ppsf";

export const ZIP_PPSF_URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz";

const TYPE_ID_TO_KEY: Record<string, string> = {
  "-1": "all",
  "6": "single_family",
  "3": "condo",
  "4": "multi_family",
  "13": "townhouse",
};

function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"'))
    return t.slice(1, -1);
  return t;
}

/** Pull a 5-digit ZIP out of Redfin's REGION cell ("Zip Code: 60616" → "60616"). */
export function zipOfRegion(region: string): string | null {
  const m = unquote(region).match(/(\d{5})/);
  return m ? m[1] : null;
}

/**
 * Stream the Redfin ZIP file into the latest median sale $/sqft per ZIP+type. Node-only (streaming). Keeps,
 * for each (zip, type), the most recent PERIOD_END row with a usable MEDIAN_PPSF.
 */
export async function fetchZipPpsf(): Promise<Record<string, PpsfByType>> {
  const res = await fetch(ZIP_PPSF_URL);
  if (!res.ok || !res.body)
    throw new Error(`Redfin ZIP file: HTTP ${res.status}`);

  const gunzip = Readable.fromWeb(res.body as any).pipe(createGunzip());
  const rl = createInterface({ input: gunzip, crlfDelay: Infinity });

  let idx: {
    region: number;
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
        period: h.indexOf("PERIOD_END"),
        type: h.indexOf("PROPERTY_TYPE_ID"),
        ppsf: h.indexOf("MEDIAN_PPSF"),
      };
      if (Object.values(idx).some((i) => i < 0))
        throw new Error("[zip-ppsf] expected columns not found");
      continue;
    }
    const f = line.split("\t");
    const typeKey = TYPE_ID_TO_KEY[unquote(f[idx.type] ?? "")];
    if (!typeKey) continue;
    const zip = zipOfRegion(f[idx.region] ?? "");
    if (!zip) continue;
    const ppsfRaw = unquote(f[idx.ppsf] ?? "");
    if (!ppsfRaw || ppsfRaw === "NA") continue;
    const psf = Math.round(Number(ppsfRaw));
    if (!Number.isFinite(psf) || psf <= 0) continue;
    const period = unquote(f[idx.period] ?? "");
    const cur = best[zip]?.[typeKey];
    if (!cur || period > cur.period) {
      (best[zip] ??= {})[typeKey] = { period, psf };
    }
  }

  const out: Record<string, PpsfByType> = {};
  for (const [zip, byType] of Object.entries(best)) {
    out[zip] = {};
    for (const [t, v] of Object.entries(byType)) out[zip][t] = v.psf;
  }
  return out;
}
