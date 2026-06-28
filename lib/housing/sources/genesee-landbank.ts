// lib/housing/sources/genesee-landbank.ts
//
// Genesee County Land Bank (thelandbank.org) — Flint, MI; the largest US land bank by count (~10,879
// parcels). Classic ASP site: a GET to `find_properties.asp?LRCsearch=do` (with a session cookie) returns
// SSR result rows whose checkboxes carry `value="parcel|street|city|zip"`, plus a property-class cell.
// Parsed directly → Property (houses only → vertical-isolated; no make/model/year read).
//
// PAGINATION CAVEAT (non-silent): the site paginates via a stateful next-button POST to
// `?LRCsearch=redo` that resists a headless replay (returns empty), so this harvests the FIRST page
// (~25 parcels) only. Full 10,879-parcel coverage needs a headed/fleet fetch driving the next-button —
// the parser below already handles any page's rows, so that scales for free once the fleet supplies them.

import type { Property, PropertyType } from "../types";

const ORIGIN = "https://www.thelandbank.org";
const FORM_URL = `${ORIGIN}/find_properties.asp`;
const SEARCH_URL = `${FORM_URL}?LRCsearch=do`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const decode = (t: string): string =>
  t
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function classify(klass: string): PropertyType {
  const s = klass.toLowerCase();
  if (/vac|vacant|\blot\b|no frontage|\bland\b/.test(s)) return "land";
  if (/comm/.test(s)) return "commercial";
  if (/indus/.test(s)) return "commercial";
  if (/agri/.test(s)) return "land";
  if (/struct|residen|home|dwelling/.test(s)) return "single_family";
  return "land"; // land-bank inventory skews vacant parcels
}

/** Parse a Genesee result page into Property rows. Each row's checkbox = parcel|street|city|zip; the
 *  property-class cell (4th rowtext div in the row) drives the type. */
export function parseGeneseeLandBank(html: string): Property[] {
  const out: Property[] = [];
  const seen = new Set<string>();
  // Split into per-row chunks at each checkbox so the class cell stays scoped to its own row.
  const rowRe =
    /value="(\d{10})\|([^|]*)\|([^|]*)\|([^"]*)"([\s\S]*?)(?=value="\d{10}\||<\/table>|$)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const parcelRaw = m[1];
    const street = decode(m[2]);
    const city = decode(m[3]);
    const zip = decode(m[4]).match(/\d{5}/)?.[0];
    const rowHtml = m[5] || "";
    if (seen.has(parcelRaw)) continue;
    seen.add(parcelRaw);

    // Visible cells repeat as rowtext divs in order: street, city, zip, class, saleType.
    const cells = Array.from(rowHtml.matchAll(/rowtext">([^<]*)</g)).map((c) =>
      decode(c[1]),
    );
    const klass = cells[3] || "";
    const saleType = cells[4] || "";

    // A dashed parcel for the detail link: 02-07-551-011 from 0207551011.
    const pid = parcelRaw;
    const dashed = `${parcelRaw.slice(0, 2)}-${parcelRaw.slice(2, 4)}-${parcelRaw.slice(4, 7)}-${parcelRaw.slice(7)}`;

    out.push({
      source: "land_bank",
      source_listing_id: `genlb-${parcelRaw}`,
      source_url: `${ORIGIN}/property_sheet.asp?pid=${pid}`,
      title: street ? `${street}, ${city} MI` : `Parcel ${dashed}`,
      property_type: classify(klass),
      address: street || undefined,
      city: city || undefined,
      state: "MI",
      zip,
      seller_type: "gov",
      seller: "Genesee County Land Bank",
      description: [klass, saleType].filter(Boolean).join(" · ") || undefined,
      signals: {
        land_bank: true,
        channel: "land_bank",
        marketplace: "genesee_landbank",
        parcel: dashed,
        property_class: klass || undefined,
        sale_type: saleType || undefined,
      },
      scraped_at: new Date().toISOString(),
    });
  }
  return out;
}

export async function scrapeGeneseeLandBank(): Promise<Property[]> {
  console.log(
    "[HomeIQ:GeneseeLandBank] harvesting (page 1 only — see PAGINATION CAVEAT)...",
  );
  try {
    // 1) GET the form to establish the ASP session cookie.
    const form = await fetch(FORM_URL, { headers: { "User-Agent": UA } });
    const cookie = (form.headers.get("set-cookie") || "")
      .split(/,(?=\s*\w+=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
    // 2) GET the search results with the session cookie.
    const res = await fetch(SEARCH_URL, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        ...(cookie ? { cookie } : {}),
      },
    });
    if (!res.ok) {
      console.warn(`[HomeIQ:GeneseeLandBank] HTTP ${res.status}`);
      return [];
    }
    const properties = parseGeneseeLandBank(await res.text());
    console.log(
      `[HomeIQ:GeneseeLandBank] found ${properties.length} (of ~10,879 — full set needs a headed fetch)`,
    );
    return properties;
  } catch (e) {
    console.warn("[HomeIQ:GeneseeLandBank] failed:", (e as Error).message);
    return [];
  }
}
