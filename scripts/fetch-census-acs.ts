#!/usr/bin/env tsx
/**
 * Refresh ZIP-level neighborhood-trajectory data from the free, keyless Census ACS 5-year API.
 * Writes lib/housing/data/zip-acs.json keyed by 5-digit ZIP → income/population/vacancy + growth vs a
 * prior vintage. Powers lib/housing/neighborhood.ts (the "rising vs declining ZIP" score).
 * Run yearly: npm run data:acs   (needs outbound network — run on the fleet/box, not the dev sandbox)
 *
 * Data: US Census Bureau, American Community Survey (https://www.census.gov/data/developers/data-sets/acs-5year.html)
 * Variables: B19013_001E median household income · B01003_001E population ·
 *            B25002_001E total units · B25002_003E vacant units (→ vacancy %).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LATEST = 2022;
const PRIOR = 2017;
const VARS = "B19013_001E,B01003_001E,B25002_001E,B25002_003E";
const num = (v: unknown): number | null => {
  const n = Number(v);
  // ACS uses large negative sentinels (e.g. -666666666) for "no data".
  return Number.isFinite(n) && n > -100000 ? n : null;
};

interface Row {
  income: number | null;
  pop: number | null;
  vacancyPct: number | null;
}

// Fetch one ACS vintage → map ZIP → {income, pop, vacancyPct}. Parses the 2D-array by HEADER name (robust
// to column reordering), not fixed index.
async function fetchYear(year: number): Promise<Record<string, Row>> {
  // The ACS API requires a FREE key (despite the common "keyless" claim — a keyless request 302s to a
  // "Missing Key" page). Grab one at https://api.census.gov/data/key_signup.html and set CENSUS_API_KEY.
  const key = process.env.CENSUS_API_KEY;
  if (!key)
    throw new Error(
      "[acs] set CENSUS_API_KEY (free: https://api.census.gov/data/key_signup.html)",
    );
  const url = `https://api.census.gov/data/${year}/acs/acs5?get=${VARS}&for=zip%20code%20tabulation%20area:*&key=${key}`;
  console.log(`[acs] ${year}: fetching all ZCTAs…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[acs] ${year} HTTP ${res.status}`);
  const rows = (await res.json()) as string[][];
  const head = rows[0];
  const col = (name: string) => head.indexOf(name);
  const iInc = col("B19013_001E");
  const iPop = col("B01003_001E");
  const iTot = col("B25002_001E");
  const iVac = col("B25002_003E");
  const iZip = col("zip code tabulation area");
  const out: Record<string, Row> = {};
  for (const r of rows.slice(1)) {
    const zip = String(r[iZip] || "").slice(0, 5);
    if (!/^\d{5}$/.test(zip)) continue;
    const tot = num(r[iTot]);
    const vac = num(r[iVac]);
    out[zip] = {
      income: num(r[iInc]),
      pop: num(r[iPop]),
      vacancyPct:
        tot && tot > 0 && vac != null
          ? Math.round((vac / tot) * 1000) / 10
          : null,
    };
  }
  return out;
}

const growth = (now: number | null, then: number | null): number | null =>
  now != null && then != null && then > 0
    ? Math.round(((now - then) / then) * 1000) / 10
    : null;

async function main() {
  const [latest, prior] = await Promise.all([
    fetchYear(LATEST),
    fetchYear(PRIOR),
  ]);
  const byZip: Record<string, unknown> = {};
  for (const [zip, cur] of Object.entries(latest)) {
    const old = prior[zip];
    byZip[zip] = {
      income: cur.income,
      pop: cur.pop,
      vacancyPct: cur.vacancyPct,
      incomeGrowthPct: growth(cur.income, old?.income ?? null),
      popGrowthPct: growth(cur.pop, old?.pop ?? null),
      vacancyDeltaPct:
        cur.vacancyPct != null && old?.vacancyPct != null
          ? Math.round((cur.vacancyPct - old.vacancyPct) * 10) / 10
          : null,
    };
  }
  const n = Object.keys(byZip).length;
  if (n < 5000)
    throw new Error(`[acs] only ${n} ZIPs — refusing partial write`);

  const outDir = join(process.cwd(), "lib", "housing", "data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "zip-acs.json"),
    JSON.stringify(
      {
        source: `US Census ACS 5-year (${PRIOR}→${LATEST}) — income/population/vacancy + growth`,
        updated: new Date().toISOString().slice(0, 10),
        byZip,
      },
      null,
      0,
    ),
  );
  console.log(`[acs] wrote ${n} ZIPs → lib/housing/data/zip-acs.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
