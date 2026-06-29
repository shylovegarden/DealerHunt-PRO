#!/usr/bin/env tsx
/**
 * Build a static zip→county-name crosswalk for county-level ARV lookups.
 *
 * Source: Census 2020 ZCTA→County relationship file (free, no auth). A ZCTA can straddle counties, so we
 * keep the county with the largest shared land area (AREALAND_PART) per ZCTA. We store only zip→countyName
 * (the property already knows its state, so no FIPS/state mapping needed). Run rarely (geography is stable):
 *   npm run data:zip-county
 *
 * © US Census Bureau (public domain).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const URL =
  "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt";

async function main() {
  console.log(`[zip-county] fetching ${URL}`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Census file: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n");
  const header = lines[0].split("|");
  const iZip = header.indexOf("GEOID_ZCTA5_20");
  const iCounty = header.indexOf("NAMELSAD_COUNTY_20");
  const iArea = header.indexOf("AREALAND_PART");
  if (iZip < 0 || iCounty < 0)
    throw new Error("[zip-county] expected columns not found");

  // zip -> { county, area } keeping the dominant (largest shared land area) county.
  const best: Record<string, { county: string; area: number }> = {};
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split("|");
    const zip = (f[iZip] || "").trim();
    const county = (f[iCounty] || "").trim();
    if (!/^\d{5}$/.test(zip) || !county) continue;
    const area = Number(f[iArea] || 0) || 0;
    const cur = best[zip];
    if (!cur || area > cur.area) best[zip] = { county, area };
  }

  const byZip: Record<string, string> = {};
  for (const [zip, v] of Object.entries(best)) byZip[zip] = v.county;
  const n = Object.keys(byZip).length;
  if (n < 30000)
    throw new Error(`[zip-county] only ${n} zips — refusing partial write`);

  const outDir = join(process.cwd(), "lib", "housing", "data");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "zip-county.json");
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        source: "US Census 2020 ZCTA→County relationship file",
        url: URL,
        byZip,
      },
      null,
      0,
    ) + "\n",
  );
  console.log(`[zip-county] wrote ${n} zips → ${outFile}`);
  console.log(
    `[zip-county] spot check: 60616=${byZip["60616"]}, 90001=${byZip["90001"]}, 77002=${byZip["77002"]}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
