// lib/housing/sources/zillow-zori.ts
//
// ZIP-level rent from Zillow's free, keyless ZORI file (Zillow Observed Rent Index — the smoothed market
// rent for a typical home, $/month). Same "download a public research CSV → snapshot it" pattern as the
// Redfin $/sqft feeds. This is the rent leg of buy-and-hold math: rent → GRM / cap-rate / cashflow. The
// CSV is wide (RegionName=ZIP, then one column PER MONTH back to 2015); we keep the LATEST non-empty value
// per ZIP.
//
// Data © Zillow (zillow.com/research/data) — free for public use with attribution.

export const ZORI_URL =
  "https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv";

/** Split one CSV line honoring quoted, comma-containing fields (Metro names have commas). */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export interface ZoriResult {
  byZip: Record<string, number>;
  latestMonth: string;
}

/**
 * Fetch + parse the ZORI ZIP file → latest market rent per 5-digit ZIP. Pure-ish (one fetch). The file is
 * ~10 MB; we load it as text (well under Node's string cap) and take each row's last non-empty monthly value.
 */
export async function fetchZoriByZip(): Promise<ZoriResult> {
  const res = await fetch(ZORI_URL);
  if (!res.ok) throw new Error(`Zillow ZORI: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) throw new Error("ZORI: empty file");

  const header = splitCsv(lines[0]);
  const zipCol = header.indexOf("RegionName");
  // Monthly columns are the date-headed ones (YYYY-MM-DD).
  const monthCols = header
    .map((h, i) => (/^\d{4}-\d{2}-\d{2}$/.test(h) ? i : -1))
    .filter((i) => i >= 0);
  if (zipCol < 0 || !monthCols.length)
    throw new Error("ZORI: expected columns not found");

  const byZip: Record<string, number> = {};
  let latestMonth = "";
  for (let li = 1; li < lines.length; li++) {
    if (!lines[li]) continue;
    const f = splitCsv(lines[li]);
    const zip = (f[zipCol] || "").trim().padStart(5, "0").slice(0, 5);
    if (!/^\d{5}$/.test(zip)) continue;
    // Walk months newest→oldest, take the first usable rent.
    for (let k = monthCols.length - 1; k >= 0; k--) {
      const raw = (f[monthCols[k]] || "").trim();
      if (!raw) continue;
      const rent = Math.round(Number(raw));
      if (Number.isFinite(rent) && rent > 0) {
        byZip[zip] = rent;
        const m = header[monthCols[k]];
        if (m > latestMonth) latestMonth = m;
        break;
      }
    }
  }
  return { byZip, latestMonth };
}
