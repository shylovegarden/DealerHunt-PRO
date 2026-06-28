#!/usr/bin/env tsx
/**
 * Refresh the median sale $/sqft reference used by the housing deal-analyzer's ARV math.
 *
 * Downloads Redfin's free, public state market-tracker file (~9 MB gz, no API key), parses the latest
 * month's median *sale* price per sqft for every state, and writes lib/housing/data/state-ppsf.json.
 * Run monthly (Redfin refreshes monthly): `npm run data:ppsf`.
 *
 * Data © Redfin (https://www.redfin.com/news/data-center) — free to use with attribution.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  fetchStatePpsf,
  REDFIN_STATE_URL,
} from "../lib/housing/sources/redfin-ppsf";

async function main() {
  console.log(`[ppsf] fetching ${REDFIN_STATE_URL}`);
  const byState = await fetchStatePpsf();
  const n = Object.keys(byState).length;
  if (n < 40) {
    throw new Error(
      `[ppsf] only ${n} states parsed — refusing to overwrite the reference with a partial result`,
    );
  }

  const outDir = join(process.cwd(), "lib", "housing", "data");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "state-ppsf.json");
  const payload = {
    source: "Redfin Data Center — state_market_tracker (median sale $/sqft)",
    url: REDFIN_STATE_URL,
    updated: new Date().toISOString().slice(0, 10),
    byState: Object.fromEntries(
      Object.entries(byState).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[ppsf] wrote ${n} states → ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
