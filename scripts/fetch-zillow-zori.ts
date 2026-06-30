#!/usr/bin/env tsx
/**
 * Refresh ZIP-level market rent (Zillow Observed Rent Index) for the buy-and-hold / cap-rate math.
 * Free + keyless. Writes lib/housing/data/zip-rent.json keyed by 5-digit ZIP → latest monthly rent.
 * Run monthly: npm run data:zori
 *
 * Data © Zillow (https://www.zillow.com/research/data/).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchZoriByZip, ZORI_URL } from "../lib/housing/sources/zillow-zori";

async function main() {
  console.log(`[zori] fetching ${ZORI_URL}…`);
  const { byZip, latestMonth } = await fetchZoriByZip();
  const n = Object.keys(byZip).length;
  if (n < 3000)
    throw new Error(`[zori] only ${n} ZIPs — refusing partial write`);

  const outDir = join(process.cwd(), "lib", "housing", "data");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "zip-rent.json");
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        source: "Zillow Observed Rent Index (ZORI) — typical market rent $/mo",
        url: ZORI_URL,
        latestMonth,
        updated: new Date().toISOString().slice(0, 10),
        byZip: Object.fromEntries(
          Object.entries(byZip).sort(([a], [b]) => a.localeCompare(b)),
        ),
      },
      null,
      0,
    ) + "\n",
  );
  console.log(`[zori] wrote ${n} ZIPs (latest ${latestMonth}) → ${outFile}`);
  for (const z of ["30303", "77494", "90011"])
    console.log(`  ${z}: $${byZip[z] ?? "—"}/mo`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
