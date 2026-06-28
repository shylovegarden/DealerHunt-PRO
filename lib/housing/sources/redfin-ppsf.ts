// lib/housing/sources/redfin-ppsf.ts
//
// Free, real sold-price reference for the ARV math. Redfin's Data Center publishes the open
// `state_market_tracker.tsv000.gz` (~9 MB, public S3, no key) where MEDIAN_PPSF = median *sale* price per
// square foot per state, refreshed monthly. That's exactly the after-repair-value basis the deal-analyzer
// was missing — a real SOLD number, not the coarse hardcoded guess. We snapshot the latest month per state
// into lib/housing/data/state-ppsf.json (via scripts/fetch-redfin-ppsf.ts) and the analyzer prefers it.
//
// Data © Redfin (redfin.com/news/data-center) — free to use with attribution. No website scraping: this is
// Redfin's intended published-data distribution channel, not the gated site.

import { gunzipSync } from "node:zlib";

export const REDFIN_STATE_URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/state_market_tracker.tsv000.gz";

// "All Residential" aggregate row (rather than a single property type).
const ALL_RESIDENTIAL_TYPE_ID = "-1";

function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"'))
    return t.slice(1, -1);
  return t;
}

/**
 * Parse the Redfin state market-tracker TSV into the latest median *sale* $/sqft per state code.
 * Pure: takes already-decompressed text. Picks, for each state, the most recent PERIOD_END row of the
 * "All Residential" aggregate that has a usable MEDIAN_PPSF. Robust to column reordering (keys by header
 * name) and to Redfin's quoting / `NA` nulls. Returns {} if the header or required columns are absent.
 */
export function parseStatePpsf(tsv: string): Record<string, number> {
  const lines = tsv.split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return {};

  const header = lines[0].split("\t").map((h) => unquote(h).toUpperCase());
  const col = (name: string) => header.indexOf(name);
  const iState = col("STATE_CODE");
  const iPeriod = col("PERIOD_END");
  const iType = col("PROPERTY_TYPE_ID");
  const iPpsf = col("MEDIAN_PPSF");
  if (iState < 0 || iPeriod < 0 || iPpsf < 0) return {};

  // state code -> { period, psf } for the freshest usable row.
  const best: Record<string, { period: string; psf: number }> = {};
  for (let r = 1; r < lines.length; r++) {
    const f = lines[r].split("\t");
    if (iType >= 0 && unquote(f[iType] ?? "") !== ALL_RESIDENTIAL_TYPE_ID)
      continue;
    const state = unquote(f[iState] ?? "").toUpperCase();
    if (!state || state.length !== 2) continue;
    const ppsfRaw = unquote(f[iPpsf] ?? "");
    if (!ppsfRaw || ppsfRaw === "NA") continue;
    const psf = Math.round(Number(ppsfRaw));
    if (!Number.isFinite(psf) || psf <= 0) continue;
    const period = unquote(f[iPeriod] ?? "");
    const cur = best[state];
    if (!cur || period > cur.period) best[state] = { period, psf };
  }

  const out: Record<string, number> = {};
  for (const [state, v] of Object.entries(best)) out[state] = v.psf;
  return out;
}

/** Download + gunzip + parse the Redfin state file into median sale $/sqft per state. Node-only. */
export async function fetchStatePpsf(): Promise<Record<string, number>> {
  const res = await fetch(REDFIN_STATE_URL);
  if (!res.ok) throw new Error(`Redfin state file: HTTP ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  const tsv = gunzipSync(gz).toString("utf8");
  return parseStatePpsf(tsv);
}
