// lib/housing/sources/tax-delinquent.ts
//
// Tax-delinquent OWNERS = the #1 free motivated-seller signal the paid platforms (PropStream/BatchLeads)
// charge for. Philadelphia publishes its full delinquency roll via a no-auth Carto SQL API with owner,
// situs + MAILING address (→ absentee detection), amount owed, and YEARS owed. We pull the actionable
// rows and normalize them into our Property schema as OFF-MARKET leads (source "tax_delinquent"), carrying
// the distress facts in `signals` so the lead scorer's owner-distress group can rank them. First county;
// the same shape generalizes to any open tax-delinquency source.
//
// Data © City of Philadelphia open data (public domain). Generalizes to other counties' free rolls.

import type { Property } from "../types";

const PHILLY_CARTO = "https://phl.carto.com/api/v2/sql";

// Raw Carto row (subset of the ~60 columns we use).
interface PhillyDelinquentRow {
  opa_number?: string | number;
  street_address?: string;
  zip_code?: string | number;
  owner?: string;
  total_due?: number;
  num_years_owed?: number | string;
  oldest_year_owed?: number | string;
  total_assessment?: number;
  building_category?: string;
  is_actionable?: string | boolean;
  payment_agreement?: string | boolean;
  sheriff_sale?: string | boolean;
  bankruptcy?: string | boolean;
  mailing_address?: string;
  mailing_city?: string;
  mailing_state?: string;
  lat?: number;
  lng?: number;
}

const truthy = (v: unknown) =>
  v === true ||
  v === "true" ||
  v === "Y" ||
  v === "yes" ||
  v === 1 ||
  v === "1";
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Philly building_category → our property_type.
function mapType(cat?: string): Property["property_type"] {
  const c = (cat || "").toLowerCase();
  if (/vacant land|land/.test(c)) return "land";
  if (/multi|apartment|duplex|triplex/.test(c)) return "multi_family";
  if (/condo/.test(c)) return "condo";
  if (/commercial|industrial|store|mixed/.test(c)) return "commercial";
  if (/single|residential|row|twin|detached/.test(c)) return "single_family";
  return undefined;
}

/**
 * Normalize Philadelphia tax-delinquency rows into off-market lead Properties. Pure. Keeps only actionable,
 * genuinely-delinquent rows (skips active payment agreements). Detects absentee owners (mailing ≠ situs;
 * out-of-state = stronger) and carries owner/debt/years + flags in `signals` for the scorer.
 */
export function parseTaxDelinquent(rows: PhillyDelinquentRow[]): Property[] {
  const out: Property[] = [];
  for (const r of rows) {
    const due = num(r.total_due);
    const years = num(r.num_years_owed);
    if (due <= 0 || !r.street_address) continue;
    if (truthy(r.payment_agreement)) continue; // already arranged — not a lead

    const situs = (r.street_address || "").trim().toUpperCase();
    const mail = (r.mailing_address || "").trim().toUpperCase();
    const outOfState =
      !!r.mailing_state && r.mailing_state.trim().toUpperCase() !== "PA";
    const absentee = (!!mail && mail !== situs) || outOfState;

    out.push({
      source: "tax_delinquent",
      source_listing_id: `phila-tax-${r.opa_number ?? situs}`,
      title: `Tax-delinquent · ${r.street_address}`,
      property_type: mapType(r.building_category),
      address: r.street_address,
      city: "Philadelphia",
      state: "PA",
      zip: r.zip_code ? String(r.zip_code).slice(0, 5) : undefined,
      lat: r.lat,
      lng: r.lng,
      // No listing price — use the assessed value as the value anchor (off-market lead).
      price: num(r.total_assessment) || undefined,
      seller_type: "owner",
      signals: {
        tax_delinquent: true,
        total_due: Math.round(due),
        years_owed: years,
        oldest_year_owed: num(r.oldest_year_owed) || undefined,
        owner: r.owner,
        owner_mailing:
          [r.mailing_address, r.mailing_city, r.mailing_state]
            .map((x) => (x == null ? "" : String(x).trim()))
            .filter(Boolean)
            .join(", ") || undefined,
        absentee,
        out_of_state_owner: outOfState,
        sheriff_sale: truthy(r.sheriff_sale),
        bankruptcy: truthy(r.bankruptcy),
        status: truthy(r.sheriff_sale)
          ? "Sheriff sale"
          : `Tax-delinquent ${years}y`,
      },
      scraped_at: undefined,
    });
  }
  return out;
}

/**
 * Fetch actionable Philadelphia tax-delinquent leads (no auth). Pulls the worst-first (most years owed,
 * highest balance) up to `limit`. Returns [] on failure so a harvest run degrades gracefully.
 */
export async function fetchPhillyTaxDelinquent(
  limit = 2000,
): Promise<Property[]> {
  const sql =
    `SELECT opa_number, street_address, zip_code, owner, total_due, num_years_owed, oldest_year_owed, ` +
    `total_assessment, building_category, is_actionable, payment_agreement, sheriff_sale, bankruptcy, ` +
    `mailing_address, mailing_city, mailing_state FROM real_estate_tax_delinquencies ` +
    `WHERE is_actionable = 'true' AND total_due > 2000 AND num_years_owed >= 2 ` +
    `ORDER BY num_years_owed DESC, total_due DESC LIMIT ${Math.min(5000, limit)}`;
  try {
    const res = await fetch(`${PHILLY_CARTO}?q=${encodeURIComponent(sql)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { rows?: PhillyDelinquentRow[] };
    return parseTaxDelinquent(json.rows || []);
  } catch {
    return [];
  }
}
