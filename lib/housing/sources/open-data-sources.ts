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
// Parse a lat/lng (longitudes are negative, so the >0 `n()` guard would wrongly drop them).
const coord = (v: unknown, fallback?: number) => {
  const x = Number(v);
  return Number.isFinite(x) && x !== 0 ? x : fallback;
};
// Join owner mailing-address components into a direct-mail-ready string (public record).
const mailing = (...parts: unknown[]) =>
  parts
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean)
    .join(", ") || undefined;

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
          owner_mailing: mailing(a.OWN_ADD, a.OWN_CITY, a.OWN_STATE, a.OWN_ZIP),
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
          owner_mailing: mailing(
            a.Own_Addr || a.OWN_ADDR,
            a.CITYNAME,
            a.STATECODE,
            a.ZIP1,
          ),
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

// Parse a string-formatted number ("  99,400" → 99400). Many county fields ship numbers as text.
const numStr = (v: unknown) => {
  const x = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(x) && x > 0 ? x : undefined;
};

// ── MORE OPEN CITY/COUNTY FEEDS (foreclosure + code violations) — verified live, no-auth ─────
export const CITY_FEED_SOURCES: OpenDataSource[] = [
  {
    // Bexar County, TX (San Antonio) — mortgage foreclosure filings (Layer 0). Point geometry.
    source: "foreclosure",
    api: "arcgis",
    url: "https://maps.bexar.org/arcgis/rest/services/CC/ForeclosuresProd/MapServer/0",
    state: "TX",
    city: "San Antonio",
    where: "YEAR >= 2025",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.ADDRESS);
      if (!address) return null;
      return {
        source: "foreclosure",
        source_listing_id: `bexar-${a.DOC_NUMBER || a.OBJECTID}`,
        title: `Foreclosure · ${address}`,
        address,
        city: s(a.CITY) || "San Antonio",
        state: "TX",
        zip: s(a.ZIP),
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: { foreclosure: true, status: "Foreclosure filed" },
      };
    },
  },
  {
    // Prince George's County, MD (DC metro) — Notice of Foreclosure Sale registrations (weekly).
    source: "foreclosure",
    api: "socrata",
    url: "https://data.princegeorgescountymd.gov/resource/cni6-nr5g.json",
    state: "MD",
    city: "Prince George's County",
    where: "submitteddate > '2025-01-01T00:00:00'",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.street_address);
      if (!address) return null;
      const vacant = String(a.addressoccupied ?? "")
        .toLowerCase()
        .startsWith("no");
      return {
        source: "foreclosure",
        source_listing_id: `pgmd-${a.propertyid || a.taxaccountnumber}`,
        title: `Foreclosure · ${address}`,
        address,
        city: s(a.city) || "Prince George's County",
        state: "MD",
        zip: s(a.zip_code),
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: { foreclosure: true, vacant, status: "Foreclosure filed" },
      };
    },
  },
  {
    // Cincinnati, OH — OPEN code-enforcement violations.
    source: "code_violation",
    api: "socrata",
    url: "https://data.cincinnati-oh.gov/resource/cncm-znd6.json",
    state: "OH",
    city: "Cincinnati",
    where: "status_class = 'OPEN'",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.full_address);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `cincy-${a.number_key}`,
        title: `Code violation · ${address}`,
        address,
        city: "Cincinnati",
        state: "OH",
        lat: coord(a.latitude, g.lat),
        lng: coord(a.longitude, g.lng),
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.comp_type_desc) || "Open code violation",
        },
      };
    },
  },
  {
    // Montgomery County, MD — active housing code violations.
    source: "code_violation",
    api: "socrata",
    url: "https://data.montgomerycountymd.gov/resource/8bbt-jrr6.json",
    state: "MD",
    city: "Montgomery County",
    where: "date_filed > '2024-01-01T00:00:00'",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.street_address);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `montco-${a.case_number}-${a.violation_id || ""}`,
        title: `Code violation · ${address}`,
        address,
        city: s(a.city) || "Montgomery County",
        state: "MD",
        zip: s(a.zip_code),
        lat: coord(a.latitude, g.lat),
        lng: coord(a.longitude, g.lng),
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.condition) || "Housing code violation",
        },
      };
    },
  },
  {
    // Buffalo, NY — ACTIVE code violations.
    source: "code_violation",
    api: "socrata",
    url: "https://data.buffalony.gov/resource/ivrf-k9vm.json",
    state: "NY",
    city: "Buffalo",
    where: "status = 'ACTIVE'",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.address);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `buffalo-${a.uniquekey || a.case_number}`,
        title: `Code violation · ${address}`,
        address,
        city: "Buffalo",
        state: "NY",
        zip: s(a.zip),
        lat: coord(a.latitude, g.lat),
        lng: coord(a.longitude, g.lng),
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.description) || "Active code violation",
        },
      };
    },
  },
];

// ── NATIONAL (statewide parcel layers with owner data → absentee, money-grade) ──────────────
export const NATIONAL_SOURCES: OpenDataSource[] = [
  {
    // HUD-owned REO (bank-owned via FHA) — HUD's OWN sanctioned eGIS layer, all 50 states (~5,500). A
    // forced institutional disposition = classic below-market flip target. Address + geo only (no price),
    // so it scores on the REO/gov distress flags, not flip math.
    source: "hud_reo",
    api: "arcgis",
    url: "https://egis.hud.gov/arcgis/rest/services/gotit/REOProperties/MapServer/0",
    state: "US",
    where: "1=1",
    limit: 6000,
    map: (a, g): Property | null => {
      const address = [a.STREET_NUM, a.DIRECTION_PREFIX, a.STREET_NAME]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .join(" ");
      const state = s(a.STATE_CODE);
      if (!address || !state) return null;
      return {
        source: "hud_reo",
        source_listing_id: `hudreo-${a.CASE_NUM || a.OBJECTID}`,
        title: `HUD REO · ${address}`,
        address,
        city: s(a.CITY),
        state,
        zip: a.DISPLAY_ZIP_CODE
          ? String(a.DISPLAY_ZIP_CODE).slice(0, 5)
          : undefined,
        lat: g.lat,
        lng: g.lng,
        seller_type: "gov",
        signals: {
          reo: true,
          owner: "HUD (bank-owned)",
          status: "HUD REO — bank-owned",
        },
      };
    },
  },
  {
    // New York STATEWIDE parcels — out-of-state absentee residential. Carries living sqft + market value
    // → real flip math via county sold $/sqft. One config = absentee leads for the whole state.
    source: "absentee_owner",
    api: "arcgis",
    url: "https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcel_Centroid_Points/FeatureServer/0",
    state: "NY",
    where:
      "MAIL_STATE NOT IN ('NY') AND (PROP_CLASS LIKE '21%' OR PROP_CLASS LIKE '22%' OR PROP_CLASS LIKE '23%') AND FULL_MARKET_VAL > 50000 AND FULL_MARKET_VAL < 900000 AND SQFT_LIVING > 500",
    limit: 6000,
    map: (a, g): Property | null => {
      const address =
        s(a.PARCEL_ADDR) ||
        [s(a.LOC_ST_NBR), s(a.LOC_STREET)].filter(Boolean).join(" ");
      if (!address) return null;
      const cls = String(a.PROP_CLASS || "");
      return {
        source: "absentee_owner",
        source_listing_id: `ny-${a.MUNI_PARCEL_ID || a.OBJECTID}`,
        title: `Absentee owner · ${address}`,
        property_type: cls.startsWith("21") ? "single_family" : "multi_family",
        address,
        city: s(a.CITYTOWN_NAME) || s(a.MUNI_NAME),
        state: "NY",
        zip: s(a.LOC_ZIP),
        lat: g.lat,
        lng: g.lng,
        price: n(a.FULL_MARKET_VAL),
        sqft: n(a.SQFT_LIVING),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.PRIMARY_OWNER),
          owner_state: s(a.MAIL_STATE),
          owner_mailing: mailing(
            a.MAIL_ADDR,
            a.MAIL_CITY,
            a.MAIL_STATE,
            a.MAIL_ZIP,
          ),
          status: `Absentee (${s(a.MAIL_STATE)})`,
        },
      };
    },
  },
  {
    // Maricopa County AZ (Phoenix metro) — out-of-state absentee. Numbers ship as formatted strings;
    // map parses them and requires a living-space value (residential filter).
    source: "absentee_owner",
    api: "arcgis",
    url: "https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0",
    state: "AZ",
    where: "MAIL_STATE NOT IN ('AZ') AND PHYSICAL_CITY IS NOT NULL",
    limit: 6000,
    map: (a, g): Property | null => {
      const parts = [
        a.PHYSICAL_STREET_NUM,
        a.PHYSICAL_STREET_DIR,
        a.PHYSICAL_STREET_NAME,
        a.PHYSICAL_STREET_TYPE,
      ]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean);
      const address = parts.join(" ") || s(a.PHYSICAL_ADDRESS);
      const sqft = numStr(a.LIVING_SPACE);
      if (!address || !sqft || sqft < 500) return null; // residential w/ a real structure
      return {
        source: "absentee_owner",
        source_listing_id: `maricopa-${a.APN}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: s(a.PHYSICAL_CITY) || "Phoenix",
        state: "AZ",
        zip: s(a.PHYSICAL_ZIP),
        lat: n(a.LATITUDE) ?? g.lat,
        lng: n(a.LONGITUDE) ?? g.lng,
        price: numStr(a.FCV_CUR),
        sqft,
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OWNER_NAME),
          owner_state: s(a.MAIL_STATE),
          owner_mailing:
            s(a.MAIL_ADDRESS) ||
            mailing(a.MAIL_ADDR1, a.MAIL_CITY, a.MAIL_STATE, a.MAIL_ZIP),
          status: `Absentee (${s(a.MAIL_STATE)})`,
        },
      };
    },
  },
];

// All configured open-data jurisdictions (grows state by state).
export const OPEN_DATA_SOURCES: OpenDataSource[] = [
  ...MISSOURI_SOURCES,
  ...NATIONAL_SOURCES,
  ...CITY_FEED_SOURCES,
];

/** Harvest all configured open-data off-market leads (Missouri-first; whole-US as configs are added). */
export function fetchOpenDataLeads(
  sources: OpenDataSource[] = OPEN_DATA_SOURCES,
): Promise<Property[]> {
  return fetchOpenDataSources(sources);
}
