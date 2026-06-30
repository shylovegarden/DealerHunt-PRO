#!/usr/bin/env tsx
/**
 * Refresh ZIP-level median sale $/sqft for the housing ARV math — the most precise free comp anchor.
 * Streams Redfin's free zip_code_market_tracker and writes lib/housing/data/zip-ppsf.json keyed by
 * 5-digit ZIP per property type. Run monthly: npm run data:zip-ppsf
 *
 * Data © Redfin (https://www.redfin.com/news/data-center).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  fetchZipPpsf,
  ZIP_PPSF_URL,
} from "../lib/housing/sources/redfin-zip-ppsf";

async function main() {
  console.log(`[zip-ppsf] streaming ${ZIP_PPSF_URL}…`);
  const byZip = await fetchZipPpsf();
  const n = Object.keys(byZip).length;
  if (n < 5000)
    throw new Error(`[zip-ppsf] only ${n} ZIPs — refusing partial write`);

  const outDir = join(process.cwd(), "lib", "housing", "data");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "zip-ppsf.json");
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        source:
          "Redfin Data Center — zip_code_market_tracker (median sale $/sqft)",
        url: ZIP_PPSF_URL,
        updated: new Date().toISOString().slice(0, 10),
        byZip: Object.fromEntries(
          Object.entries(byZip).sort(([a], [b]) => a.localeCompare(b)),
        ),
      },
      null,
      0,
    ) + "\n",
  );
  console.log(`[zip-ppsf] wrote ${n} ZIPs → ${outFile}`);
  for (const z of ["30303", "60616", "90011"])
    console.log(`  ${z}: ${JSON.stringify(byZip[z])}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
