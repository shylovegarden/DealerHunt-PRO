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
    // Los Angeles — Building & Safety vacant-building abatement cases. An open code case on a VACANT
    // building = a carrying-cost-bleeding, often-absentee owner under city pressure (a PropStream-grade
    // distress lead). Residential only (drop commercial/warehouse/hotel); current cases only. No geo/owner
    // in the feed → geocoded by address on upsert. building_size is lot dims, NOT sqft → no ARV.
    source: "vacant_building",
    api: "socrata",
    url: "https://data.lacity.org/resource/q3ak-s5hy.json",
    state: "CA",
    city: "Los Angeles",
    where:
      "(approved_use IN('SFD','DUPLEX','APT','MIXED USE') OR approved_use IS NULL) AND abate_effective > '2023-01-01'",
    limit: 5000,
    map: (a): Property | null => {
      const address = s(a.address);
      if (!address) return null;
      const use = (a.approved_use || "").toUpperCase();
      const type: Property["property_type"] = /DUPLEX|APT/.test(use)
        ? "multi_family"
        : /SFD/.test(use)
          ? "single_family"
          : undefined;
      return {
        source: "vacant_building",
        // Key by address so repeat cases on one building collapse to a single lead.
        source_listing_id: `la-vac-${address.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: `Vacant building · ${address}`,
        property_type: type,
        address,
        city: "Los Angeles",
        state: "CA",
        seller_type: "owner",
        signals: {
          vacant: true,
          status: "Vacant — city code abatement",
          case: s(a.case_num),
        },
      };
    },
  },
  {
    // New York City — the annual tax-lien SALE list (properties whose unpaid taxes/charges are about to be
    // sold to a lien trust → the owner can lose the property). Severe financial distress in the biggest US
    // market. Residential building classes (A=1-fam, B=2-fam, C=walk-up apts), recent cycles only. No geo/
    // owner in the feed → geocoded by address (house # + street + borough) on upsert.
    source: "tax_delinquent",
    api: "socrata",
    url: "https://data.cityofnewyork.us/resource/9rz4-mjek.json",
    state: "NY",
    city: "New York",
    where:
      "(building_class LIKE 'A%' OR building_class LIKE 'B%' OR building_class LIKE 'C%') AND month > '2024-06-01'",
    limit: 5000,
    map: (a): Property | null => {
      const street = [s(a.house_number), s(a.street_name)]
        .filter(Boolean)
        .join(" ");
      if (!street || !a.block || !a.lot) return null;
      const boro =
        (
          {
            "1": "Manhattan",
            "2": "Bronx",
            "3": "Brooklyn",
            "4": "Queens",
            "5": "Staten Island",
          } as Record<string, string>
        )[String(a.borough)] || "New York";
      const cls = String(a.building_class || "");
      return {
        source: "tax_delinquent",
        // Borough-Block-Lot = NYC's parcel id → dedupes a property that recurs across monthly cycles.
        source_listing_id: `nyc-tl-${a.borough}-${a.block}-${a.lot}`,
        title: `Tax-lien sale list · ${street}`,
        property_type: cls.startsWith("A") ? "single_family" : "multi_family",
        address: street,
        city: boro,
        state: "NY",
        zip: s(a.zip_code),
        seller_type: "owner",
        signals: {
          tax_delinquent: true,
          status: "On NYC tax-lien sale list",
          // "water_debt_only = Y" = only a water charge (lesser); N = an actual property-tax lien.
          water_only: String(a.water_debt_only).toUpperCase() === "Y",
        },
      };
    },
  },
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
    // New York City — HPD housing-maintenance violations, Class C (immediately hazardous) + still open.
    // No lat/lng or owner in this feed (block/lot/boro only) → address-level, maps to state centroid.
    source: "code_violation",
    api: "socrata",
    url: "https://data.cityofnewyork.us/resource/wvxf-dwi5.json",
    state: "NY",
    city: "New York",
    where: "currentstatus = 'NOV SENT OUT' AND class = 'C'",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = [s(a.housenumber), s(a.streetname)]
        .filter(Boolean)
        .join(" ");
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `nyc-hpd-${a.violationid}`,
        title: `Code violation (Class C) · ${address}`,
        address,
        city: s(a.boro) || "New York",
        state: "NY",
        zip: s(a.zip),
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: "Class C — immediately hazardous",
        },
      };
    },
  },
  {
    // Chicago, IL — Vacant & Abandoned Buildings violations with a balance due (vacant + code distress).
    source: "code_violation",
    api: "socrata",
    url: "https://data.cityofchicago.org/resource/kc9i-wq85.json",
    state: "IL",
    city: "Chicago",
    where: "current_amount_due > 0",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.property_address);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `chivac-${a.docket_number}-${a.violation_number || ""}`,
        title: `Vacant / code violation · ${address}`,
        address,
        city: "Chicago",
        state: "IL",
        lat: coord(a.latitude, g.lat),
        lng: coord(a.longitude, g.lng),
        seller_type: "owner",
        signals: {
          code_violation: true,
          vacant: true,
          total_due: n(a.current_amount_due),
          status: s(a.violation_type) || "Vacant building violation",
        },
      };
    },
  },
  {
    // Norfolk, VA — delinquent real-estate taxes (owner + amount). Address-only → maps to state centroid.
    source: "tax_delinquent",
    api: "socrata",
    url: "https://data.norfolk.gov/resource/7qie-z5gv.json",
    state: "VA",
    city: "Norfolk",
    where: "total > 1000",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.address);
      if (!address) return null;
      return {
        source: "tax_delinquent",
        source_listing_id: `norfolk-tax-${a.account || address}`,
        title: `Tax-delinquent · ${address}`,
        address,
        city: "Norfolk",
        state: "VA",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          tax_delinquent: true,
          total_due: n(a.total),
          owner: s(a.owner_name),
          status: "Tax-delinquent",
        },
      };
    },
  },
  {
    // Richmond, VA — delinquent real-estate taxes with YEARS owed + owner. Address-only → state centroid.
    source: "tax_delinquent",
    api: "socrata",
    url: "https://data.richmondgov.com/resource/83t5-hbac.json",
    state: "VA",
    city: "Richmond",
    // total_due ships as TEXT here, so we can't filter numerically server-side — filter in the map.
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.physical_address);
      if (!address || address === "0") return null;
      const due = n(a.total_due);
      if (!due || due < 1000) return null;
      const yrs = n(a.total_years_del);
      return {
        source: "tax_delinquent",
        source_listing_id: `richmond-tax-${a.property_code || address}`,
        title: `Tax-delinquent · ${address}`,
        address,
        city: "Richmond",
        state: "VA",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          tax_delinquent: true,
          total_due: due,
          years_owed: yrs,
          owner: s(a.current_owner_name_1),
          status: yrs ? `Tax-delinquent ${yrs}y` : "Tax-delinquent",
        },
      };
    },
  },
  {
    // New Orleans, LA — Code Enforcement OPEN cases (verified live 2026-07: 7,249 open since 2024). A big
    // blight market; `geoaddress` + zip, status in `stage`/`keystatus`. Coords ship as LA State Plane (not
    // WGS84) → we omit them and geocode by address on upsert. Filter out closed cases in the WHERE.
    source: "code_violation",
    api: "socrata",
    url: "https://data.nola.gov/resource/u6yx-v2tw.json",
    state: "LA",
    city: "New Orleans",
    where:
      "casefiled > '2024-01-01T00:00:00' AND keystatus NOT LIKE '%closed%'",
    limit: 5000,
    map: (a): Property | null => {
      const address = s(a.geoaddress);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `nola-ce-${a.caseid || a.caseno}`,
        title: `Code violation · ${address}`,
        address,
        city: "New Orleans",
        state: "LA",
        zip: s(a.zipcode),
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.stage) || "Open code case",
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
    // Montana STATEWIDE cadastral (gisservicemt.gov) — out-of-state absentee owners of improved
    // residential parcels. Verified live 2026-07: 31,192 out-of-state-owned improved homes, rich owner +
    // mailing + assessed value (MT has heavy out-of-state second-home ownership). One config = the whole
    // state. City/zip parse out of the combined `CityStateZip` situs field.
    source: "absentee_owner",
    api: "arcgis",
    url: "https://gisservicemt.gov/arcgis/rest/services/MSDI_Framework/Parcels/MapServer/0",
    state: "MT",
    where:
      "OwnerState <> 'MT' AND OwnerState IS NOT NULL AND PropType = 'Improved Property' AND TotalBuildingValue > 30000",
    limit: 6000,
    map: (a, g): Property | null => {
      const address = s(a.AddressLine1);
      if (!address) return null;
      const csz = String(a.CityStateZip || ""); // "LIBBY, MT 59923"
      const city = csz.split(",")[0]?.trim() || undefined;
      const zip = (csz.match(/\b(\d{5})\b/) || [])[1];
      return {
        source: "absentee_owner",
        source_listing_id: `mt-${a.PARCELID || a.OBJECTID}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city,
        state: "MT",
        zip,
        lat: g.lat,
        lng: g.lng,
        price: n(a.TotalValue), // assessed value (off-market — no list price)
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OwnerName),
          owner_state: s(a.OwnerState),
          owner_mailing: mailing(
            a.OwnerAddress1,
            a.OwnerCity,
            a.OwnerState,
            a.OwnerZipCode,
          ),
          status: `Absentee (${s(a.OwnerState)})`,
        },
      };
    },
  },
  {
    // Massachusetts STATEWIDE (MassGIS L3 standardized assessor parcels) — out-of-state absentee single-
    // family owners. Verified live 2026-07: 44,167 out-of-state-owned SFHs, each with owner + FULL mailing
    // (OWN_ADDR/CITY/STATE/ZIP) + assessed value + living sqft (RES_AREA) → real flip/ARV math. USE_CODE
    // '101' = single family (MA state class code). One config = the whole state, money-grade.
    source: "absentee_owner",
    api: "arcgis",
    url: "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0",
    state: "MA",
    where:
      "OWN_STATE<>'MA' AND OWN_STATE IS NOT NULL AND USE_CODE LIKE '101%' AND RES_AREA>500 AND TOTAL_VAL>60000",
    limit: 6000,
    map: (a, g): Property | null => {
      const address = s(a.SITE_ADDR);
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `ma-${a.LOC_ID || a.OBJECTID}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: s(a.CITY),
        state: "MA",
        zip: s(a.ZIP),
        lat: g.lat,
        lng: g.lng,
        price: n(a.TOTAL_VAL), // assessed value (off-market — no list price)
        sqft: n(a.RES_AREA),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OWNER1),
          owner_state: s(a.OWN_STATE),
          owner_mailing: mailing(
            a.OWN_ADDR,
            a.OWN_CITY,
            a.OWN_STATE,
            a.OWN_ZIP,
          ),
          status: `Absentee (${s(a.OWN_STATE)})`,
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
