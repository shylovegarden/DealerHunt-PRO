// lib/housing/sources/reso.ts
//
// The MLS door — done the RIGHT way. RESO Web API is the industry-standard OData feed every MLS (MARIS
// included) distributes to its licensed members (directly or via Bridge / Trestle / Spark). It's the SAME
// on-market listing data Zillow/Realtor/Redfin resell — legitimately accessible the moment a member supplies
// credentials. No scraping, no anti-bot, no license risk. Off-by-default: with no creds it returns [] so it
// ships safe and lights up instantly when RESO_* env is set.
//
// Env:
//   RESO_API_URL     OData base, e.g. https://api.bridgedataoutput.com/api/v2/OData/<dataset>
//   RESO_TOKEN       a static access token (Bridge/Trestle issue these) — simplest
//   — or OAuth2 client-credentials —
//   RESO_TOKEN_URL   token endpoint
//   RESO_CLIENT_ID / RESO_CLIENT_SECRET / RESO_SCOPE
//   RESO_FILTER      OData $filter (default: active listings)
//   RESO_MAX         max rows per harvest (default 5000)

import type { Property } from "../types";

const PAGE = 200; // RESO servers commonly cap $top around 200

// RESO PropertySubType / PropertyType → our property_type.
function mapType(sub?: string, type?: string): Property["property_type"] {
  const t = `${sub || ""} ${type || ""}`.toLowerCase();
  if (/condo/.test(t)) return "condo";
  if (/town/.test(t)) return "townhouse";
  if (/multi|duplex|triplex|two[\s-]?family|fourplex|3 family/.test(t))
    return "multi_family";
  if (/land|lot|vacant|acre/.test(t)) return "land";
  if (/single|detached|residential/.test(t)) return "single_family";
  return undefined;
}

const s = (v: unknown) =>
  v == null ? undefined : String(v).trim() || undefined;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Map one RESO `Property` record (RESO Data Dictionary fields) into a HomeIQ Property. */
export function parseResoProperty(r: Record<string, any>): Property | null {
  const id = s(r.ListingKey) || s(r.ListingId);
  if (!id) return null;
  const address =
    s(r.UnparsedAddress) ||
    [r.StreetNumber, r.StreetDirPrefix, r.StreetName, r.StreetSuffix]
      .map((x) => s(x))
      .filter(Boolean)
      .join(" ") ||
    undefined;
  if (!address) return null;

  const media = Array.isArray(r.Media) ? r.Media : [];
  const images = media
    .filter(
      (m: any) => !m.MediaCategory || /photo|image/i.test(m.MediaCategory),
    )
    .sort((a: any, b: any) => (a.Order ?? 0) - (b.Order ?? 0))
    .map((m: any) => s(m.MediaURL))
    .filter(Boolean) as string[];

  return {
    source: "mls",
    source_listing_id: `mls-${id}`,
    source_url: s(r.ListingURL) || undefined,
    title: address,
    property_type: mapType(r.PropertySubType, r.PropertyType),
    // Public remarks feed the distress-keyword scorer (as-is / motivated / fixer → scored automatically).
    description: s(r.PublicRemarks),
    address,
    city: s(r.City),
    state: s(r.StateOrProvince),
    zip: s(r.PostalCode)?.slice(0, 5),
    lat: num(r.Latitude),
    lng: num(r.Longitude),
    price: num(r.ListPrice),
    beds: num(r.BedroomsTotal),
    baths: num(r.BathroomsTotalInteger ?? r.BathroomsFull),
    sqft: num(r.LivingArea),
    lot_size_acres: num(r.LotSizeAcres),
    year_built: num(r.YearBuilt),
    images: images.length ? images : undefined,
    seller_type: "agent",
    signals: {
      mls: true,
      status: s(r.StandardStatus) || "Active",
      mls_number: s(r.ListingId),
      agent: s(r.ListAgentFullName),
      // On-market listings ARE for sale at ListPrice, so flip math here is real (unlike off-market rows).
    },
    scraped_at: s(r.ModificationTimestamp),
  };
}

function cfg(states: string[] = []) {
  // Demand-driven scope: constrain the OData $filter to the active states. StateOrProvince holds the
  // 2-letter code in the RESO Data Dictionary.
  const base = process.env.RESO_FILTER || "StandardStatus eq 'Active'";
  const stateClause = states
    .map((s) => `StateOrProvince eq '${s.toUpperCase()}'`)
    .join(" or ");
  const filter = stateClause ? `(${base}) and (${stateClause})` : base;
  return {
    apiUrl: process.env.RESO_API_URL || "",
    token: process.env.RESO_TOKEN || "",
    tokenUrl: process.env.RESO_TOKEN_URL || "",
    clientId: process.env.RESO_CLIENT_ID || "",
    clientSecret: process.env.RESO_CLIENT_SECRET || "",
    scope: process.env.RESO_SCOPE || "",
    filter,
    max: Math.max(1, parseInt(process.env.RESO_MAX || "5000", 10) || 5000),
  };
}

/** OAuth2 client-credentials token (when a static RESO_TOKEN isn't provided). */
async function getToken(c: ReturnType<typeof cfg>): Promise<string | null> {
  if (c.token) return c.token;
  if (!c.tokenUrl || !c.clientId || !c.clientSecret) return null;
  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: c.clientId,
      client_secret: c.clientSecret,
    });
    if (c.scope) body.set("scope", c.scope);
    const res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Harvest MLS listings via the RESO Web API. Returns [] (with a log) when no credentials are configured,
 * so it's safe to wire into the harvest before a feed exists. Paginates $top/$skip up to RESO_MAX.
 */
export async function harvestReso(states: string[] = []): Promise<Property[]> {
  const c = cfg(states);
  if (!c.apiUrl) {
    console.log(
      "[HomeIQ:RESO] no RESO_API_URL configured — skipping (legit MLS feed not wired yet)",
    );
    return [];
  }
  const token = await getToken(c);
  if (!token) {
    console.warn(
      "[HomeIQ:RESO] no token (set RESO_TOKEN or client-credentials) — skipping",
    );
    return [];
  }

  const byId = new Map<string, Property>();
  for (let skip = 0; skip < c.max; skip += PAGE) {
    const top = Math.min(PAGE, c.max - skip);
    const url =
      `${c.apiUrl.replace(/\/$/, "")}/Property?` +
      `$filter=${encodeURIComponent(c.filter)}&$top=${top}&$skip=${skip}` +
      `&$orderby=${encodeURIComponent("ModificationTimestamp desc")}&$expand=Media`;
    let json: { value?: Record<string, any>[] };
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        console.warn(`[HomeIQ:RESO] ${res.status} at skip=${skip} — stopping`);
        break;
      }
      json = await res.json();
    } catch (e) {
      console.warn("[HomeIQ:RESO] fetch failed:", (e as Error).message);
      break;
    }
    const rows = json.value || [];
    for (const r of rows) {
      const p = parseResoProperty(r);
      if (p) byId.set(p.source_listing_id!, p);
    }
    if (rows.length < top) break; // last page
  }
  const out = Array.from(byId.values());
  console.log(`[HomeIQ:RESO] ${out.length} MLS listings`);
  return out;
}
