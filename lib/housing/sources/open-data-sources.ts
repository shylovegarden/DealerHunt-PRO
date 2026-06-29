// lib/housing/sources/open-data-sources.ts
//
// The CONFIG REGISTRY for nationwide off-market lead coverage — each entry is one city/county open-data
// feed mapped onto the generic engine in open-data.ts. Adding a jurisdiction = add a config here. Starting
// Missouri-first (St. Louis + Kansas City metros), then expanding across the state and the US. Every map
// emits the distress `signals` the lead scorer already ranks (vacant / code_violation / tax_delinquent /
// absentee / land_bank).

import type { Property } from "../types";
import { fetchOpenDataSources, type OpenDataSource } from "./open-data";

const s = (v: unknown) =>
  v == null ? undefined : String(v).trim() || undefined;
const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : undefined;
};
// Socrata GeoJSON point column → {lat,lng} ([lng,lat] order).
function pointLatLng(geo: any): { lat?: number; lng?: number } {
  const c = geo?.coordinates;
  if (Array.isArray(c) && c.length >= 2)
    return { lng: Number(c[0]), lat: Number(c[1]) };
  return {};
}

function mapClass(cls?: string): Property["property_type"] {
  const c = (cls || "").toLowerCase();
  if (/single|residential/.test(c) && !/vacant/.test(c)) return "single_family";
  if (/multi|apartment|duplex/.test(c)) return "multi_family";
  if (/condo/.test(c)) return "condo";
  if (/vacant|land|lot/.test(c)) return "land";
  return undefined;
}

// ── MISSOURI ──────────────────────────────────────────────────────────────
export const MISSOURI_SOURCES: OpenDataSource[] = [
  {
    // Kansas City Land Bank & Homesteading — public inventory sold cheap; carries asking_price +
    // market_value + sqft + owner → an equity-visible, money-grade off-market lead.
    source: "land_bank",
    api: "socrata",
    url: "https://data.kcmo.org/resource/4257-6mtc.json",
    state: "MO",
    city: "Kansas City",
    where: "available = true",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.address);
      if (!address) return null;
      const asking = n(a.asking_price);
      const mv = n(a.market_value);
      const belowMarket = !!(asking && mv && asking < mv * 0.7);
      return {
        source: "land_bank",
        source_listing_id: `kcmo-lb-${a.parcel_number}`,
        title: `Land bank · ${address}`,
        property_type: mapClass(a.property_class),
        address,
        city: "Kansas City",
        state: "MO",
        zip: s(a.zip_code),
        lat: g.lat,
        lng: g.lng,
        price: asking ?? mv, // the land-bank acquisition price
        seller_type: "gov",
        signals: {
          land_bank: true,
          market_value: mv,
          below_market: belowMarket,
          owner: s(a.current_owners),
          status: s(a.property_status) || "Land bank — available",
        },
      };
    },
  },
  {
    // St. Louis City Assessor — distressed parcels only (tax-delinquent OR vacant building). Carries
    // TaxBalDue + vacancy + out-of-state owner + assessed value. SQFT here mixes building/lot, so we do
    // NOT trust it for ARV (0-margin-for-error) — these score on owner-distress, not flip math.
    source: "tax_delinquent",
    api: "arcgis",
    url: "https://maps8.stlouis-mo.gov/arcgis/rest/services/ASSESSOR/Assessor_Public_Parcels/MapServer/11",
    state: "MO",
    city: "St. Louis",
    where: "TaxBalDue > 1000 OR VacBldgYear > 0",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.SITEADDR);
      if (!address) return null;
      const taxDue = n(a.TaxBalDue);
      const vacant = (n(a.VacBldgYear) || 0) > 0 || a.VacantLot === 1;
      const outOfState =
        !!a.OwnerState && String(a.OwnerState).toUpperCase() !== "MO";
      return {
        source: "tax_delinquent",
        source_listing_id: `stl-${a.ParcelId}`,
        title: `${vacant ? "Vacant / " : ""}Tax-delinquent · ${address.trim()}`,
        address: address.trim(),
        city: "St. Louis",
        state: "MO",
        lat: g.lat,
        lng: g.lng,
        price: n(a.AsdTotal),
        seller_type: "owner",
        signals: {
          tax_delinquent: !!taxDue,
          total_due: taxDue,
          vacant,
          out_of_state_owner: outOfState,
          absentee: outOfState,
          owner: s(a.OwnerName),
          status: vacant ? "Vacant" : "Tax-delinquent",
        },
      };
    },
  },
  {
    // St. Louis County Assessor — out-of-state ABSENTEE owners of residential parcels (a core PropStream
    // list: remote owners with carrying costs, more willing to deal). Carries value + sqft + year.
    source: "absentee_owner",
    api: "arcgis",
    url: "https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0",
    state: "MO",
    city: "St. Louis County",
    where:
      "OWN_STATE<>'MO' AND TOTAPVAL>40000 AND RESQFT>700 AND PROPCLASS='R'",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.PROP_ADD);
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `stlco-${a.LOCATOR}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: s(a.MUNICIPALITY) || "St. Louis County",
        state: "MO",
        lat: g.lat,
        lng: g.lng,
        price: n(a.TOTAPVAL), // assessed value (off-market — no list price)
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OWNER_NAME),
          owner_state: s(a.OWN_STATE),
          status: `Absentee (${s(a.OWN_STATE)})`,
        },
      };
    },
  },
  {
    // Greene County (Springfield) Assessor — out-of-state absentee residential. iasWorld rejects
    // resultOffset, so use OID-batch paging.
    source: "absentee_owner",
    api: "arcgis",
    url: "https://greenecountyassessor.org/arcgis/rest/services/IasWorldParcel5/MapServer/0",
    state: "MO",
    city: "Springfield",
    paging: "oid",
    where: "STATECODE<>'MO' AND P_VALAPR3>40000 AND SFLA>700",
    limit: 4000,
    map: (a, g): Property | null => {
      // iasWorld stores the situs as components (ADRNO/ADRDIR/ADRSTR/ADRSUF); PropAdr is sparse.
      const parts = [a.ADRNO, a.ADRDIR, a.ADRSTR, a.ADRSUF]
        .map((x) => String(x ?? "").trim())
        .filter((x) => x && x !== "0");
      const address = parts.join(" ") || s(a.PropAdr);
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `greene-${a.PARID}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: "Springfield",
        state: "MO",
        lat: g.lat,
        lng: g.lng,
        price: n(a.P_VALAPR3),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OWN1),
          owner_state: s(a.STATECODE),
          status: `Absentee (${s(a.STATECODE)})`,
        },
      };
    },
  },
  {
    // Kansas City "Dangerous Buildings" — open structural-danger cases = vacant/severe distress.
    source: "dangerous_building",
    api: "socrata",
    url: "https://data.kcmo.org/resource/ax3m-jhxx.json",
    state: "MO",
    city: "Kansas City",
    where: "statusofcase = 'Ongoing Case'",
    limit: 3000,
    map: (a): Property | null => {
      const address = s(a.address);
      if (!address) return null;
      const { lat, lng } = pointLatLng(a.case_location);
      return {
        source: "dangerous_building",
        source_listing_id: `kcmo-db-${a.pin || a.casenumber}`,
        title: `Dangerous building · ${address}`,
        address,
        city: "Kansas City",
        state: "MO",
        zip: s(a.zip_code),
        lat,
        lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          vacant: true,
          dangerous: true,
          violation_count: 1,
          status: "Dangerous building",
        },
      };
    },
  },
];

// All configured open-data jurisdictions (grows state by state).
export const OPEN_DATA_SOURCES: OpenDataSource[] = [...MISSOURI_SOURCES];

/** Harvest all configured open-data off-market leads (Missouri-first; whole-US as configs are added). */
export function fetchOpenDataLeads(
  sources: OpenDataSource[] = OPEN_DATA_SOURCES,
): Promise<Property[]> {
  return fetchOpenDataSources(sources);
}
