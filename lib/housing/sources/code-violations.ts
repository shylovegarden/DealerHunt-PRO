// lib/housing/sources/code-violations.ts
//
// Open CODE VIOLATIONS = accruing municipal fines + an owner who wants the liability gone → a deep-discount
// "as-is" seller. The research flagged this as an overlooked goldmine even the big platforms (DealMachine)
// lag on, because the data is FOIA/scrape-hard. Philadelphia exposes its full L&I violation roll via the
// same no-auth Carto SQL API as the tax-delinquency roll. We aggregate OPEN violations per property into
// off-market lead Properties (source "code_violation"), flagging vacancy/unsafe/demolish — the strongest
// occupancy-distress tell. First county; generalizes to any open code-enforcement source (NYC/Chicago…).
//
// Data © City of Philadelphia open data (public domain).

import type { Property } from "../types";

const PHILLY_CARTO = "https://phl.carto.com/api/v2/sql";

interface ViolationRow {
  opa_account_num?: string | number;
  address?: string;
  zip?: string | number;
  owner?: string;
  violations?: number | string;
  severe?: boolean | string;
  market_value?: number | string;
  sqft?: number | string;
  category?: string;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const truthy = (v: unknown) => v === true || v === "true" || v === "t";

function mapType(cat?: string): Property["property_type"] {
  const c = (cat || "").toLowerCase();
  if (/vacant land|^land/.test(c)) return "land";
  if (/multi/.test(c)) return "multi_family";
  if (/condo/.test(c)) return "condo";
  if (/single/.test(c)) return "single_family";
  return undefined; // mixed-use / commercial → leave unset
}

/** Normalize aggregated Philadelphia code-violation rows (joined to assessment) into lead Properties. */
export function parseCodeViolations(rows: ViolationRow[]): Property[] {
  const out: Property[] = [];
  for (const r of rows) {
    const n = num(r.violations);
    if (!r.address || n <= 0) continue;
    const severe = truthy(r.severe);
    const sqft = num(r.sqft);
    out.push({
      source: "code_violation",
      source_listing_id: `phila-ci-${r.opa_account_num ?? r.address}`,
      title: `Code violations (${n}) · ${r.address}`,
      property_type: mapType(r.category),
      city: "Philadelphia",
      state: "PA",
      zip: r.zip ? String(r.zip).slice(0, 5) : undefined,
      // Assessed market value as the value anchor; sqft enables the county-$/sqft ARV → real flip math.
      price: num(r.market_value) || undefined,
      sqft: sqft > 100 ? sqft : undefined,
      seller_type: "owner",
      signals: {
        code_violation: true,
        violation_count: n,
        vacant: severe,
        owner: r.owner,
        status: severe ? "Vacant / unsafe" : `${n} open violations`,
      },
    });
  }
  return out;
}

/**
 * Fetch Philadelphia properties with the most OPEN code violations (no auth). Aggregates per parcel and
 * flags vacancy/unsafe/demolish. Returns [] on failure so a harvest degrades gracefully.
 */
export async function fetchPhillyCodeViolations(
  limit = 1500,
): Promise<Property[]> {
  // Join the assessment roll for value + sqft, and filter to flipper-relevant residential parcels (sane
  // value/size, exclude government/authority owners) so we surface real motivated sellers — not a housing
  // authority's 76-violation tower.
  const sql =
    `SELECT v.opa_account_num, MAX(v.address) AS address, MAX(v.zip) AS zip, MAX(v.opa_owner) AS owner, ` +
    `COUNT(*) AS violations, ` +
    `bool_or(v.violationcodetitle ILIKE '%vacant%' OR v.violationcodetitle ILIKE '%unsafe%' OR v.violationcodetitle ILIKE '%dangerous%' OR v.violationcodetitle ILIKE '%demolish%') AS severe, ` +
    `MAX(p.market_value) AS market_value, MAX(p.total_livable_area) AS sqft, MAX(p.category_code_description) AS category ` +
    `FROM violations v JOIN opa_properties_public p ON v.opa_account_num = p.parcel_number ` +
    `WHERE v.violationstatus = 'OPEN' AND v.opa_account_num IS NOT NULL ` +
    `AND p.market_value > 15000 AND p.market_value < 600000 ` +
    `AND p.total_livable_area > 400 AND p.total_livable_area < 6000 ` +
    `AND v.opa_owner NOT ILIKE '%authority%' AND v.opa_owner NOT ILIKE '%city of%' ` +
    `AND v.opa_owner NOT ILIKE '%commonwealth%' AND v.opa_owner NOT ILIKE '%redevelop%' ` +
    `GROUP BY v.opa_account_num ORDER BY violations DESC LIMIT ${Math.min(5000, limit)}`;
  try {
    const res = await fetch(`${PHILLY_CARTO}?q=${encodeURIComponent(sql)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { rows?: ViolationRow[] };
    return parseCodeViolations(json.rows || []);
  } catch {
    return [];
  }
}
