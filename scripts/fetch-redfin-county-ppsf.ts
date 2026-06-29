#!/usr/bin/env tsx
/**
 * Refresh county-level median sale $/sqft for the housing ARV math. Streams Redfin's free
 * county_market_tracker (~241 MB gz) and writes lib/housing/data/county-ppsf.json keyed by "county|ST"
 * per property type. Run monthly: npm run data:county-ppsf
 *
 * Data © Redfin (https://www.redfin.com/news/data-center).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  fetchCountyPpsf,
  COUNTY_PPSF_URL,
} from "../lib/housing/sources/redfin-county-ppsf";

async function main() {
  console.log(`[county-ppsf] streaming ${COUNTY_PPSF_URL} (~241 MB)…`);
  const byCounty = await fetchCountyPpsf();
  const n = Object.keys(byCounty).length;
  if (n < 1500)
    throw new Error(
      `[county-ppsf] only ${n} counties — refusing partial write`,
    );

  const outDir = join(process.cwd(), "lib", "housing", "data");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "county-ppsf.json");
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        source:
          "Redfin Data Center — county_market_tracker (median sale $/sqft)",
        url: COUNTY_PPSF_URL,
        updated: new Date().toISOString().slice(0, 10),
        byCounty: Object.fromEntries(
          Object.entries(byCounty).sort(([a], [b]) => a.localeCompare(b)),
        ),
      },
      null,
      0,
    ) + "\n",
  );
  console.log(`[county-ppsf] wrote ${n} counties → ${outFile}`);
  for (const k of [
    "cook county|IL",
    "los angeles county|CA",
    "harris county|TX",
  ])
    console.log(`  ${k}: ${JSON.stringify(byCounty[k])}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
