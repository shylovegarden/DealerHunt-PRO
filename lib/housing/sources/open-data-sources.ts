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
    // Cook County (Chicago) Assessor parcel roll — out-of-state ABSENTEE owners, direct-mail ready (owner
    // name + full mailing address). Fills the single biggest IL gap: we had ZERO Illinois absentee, and
    // this is ~65k current out-of-state owners in the 2nd-largest US county. The roll carries historical
    // years, so pin to the current one — BUMP the year each year as Cook publishes the new roll. No geo in
    // the feed → geocoded by property address on upsert.
    source: "absentee_owner",
    api: "socrata",
    url: "https://datacatalog.cookcountyil.gov/resource/3723-97qp.json",
    state: "IL",
    city: "Cook County",
    where:
      "year='2026.0' AND mail_address_state IS NOT NULL AND mail_address_state != 'IL' AND prop_address_full IS NOT NULL",
    limit: 50000, // ~65k available — capture the full set (engine ceiling 50k); geocoded on upsert
    map: (a): Property | null => {
      const address = s(a.prop_address_full);
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `cook-abs-${a.pin}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: s(a.prop_address_city_name) || "Chicago",
        state: "IL",
        zip: s(a.prop_address_zipcode_1),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.mail_address_name),
          owner_state: s(a.mail_address_state),
          owner_mailing: mailing(
            a.mail_address_full,
            a.mail_address_city_name,
            a.mail_address_state,
            a.mail_address_zipcode_1,
          ),
          status: `Absentee (${s(a.mail_address_state)})`,
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
    limit: 50000, // ~53k available statewide — capture the full owner-rich set (engine ceiling is 50k)
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
    limit: 32000, // ~31k available — capture the full state (was capped at 6k)
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
    limit: 45000, // ~44k available — capture the full state (was capped at 6k)
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
    limit: 20000, // Maricopa is huge; the map() filters residential post-fetch, so cap raw pulls at 20k
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

// ── National metro distress feeds (2026-07, each curl-verified live: 200 + real residential rows). All
// free, no-auth, no-anti-bot gov open data — the highest-ROI coverage path (data-without-HTML). ArcGIS
// geometry comes back as lat/lng (engine sends outSR=4326); NOLA has no geometry → geocoded by address. ──
const METRO_DISTRESS_SOURCES: OpenDataSource[] = [
  {
    // Baltimore, MD — open Vacant Building Notices (~11.6k). Every row is an active vacant designation.
    source: "vacant_building",
    api: "arcgis",
    url: "https://egisdata.baltimorecity.gov/egis/rest/services/Housing/DHCD_Open_Baltimore_Datasets/FeatureServer/1",
    state: "MD",
    city: "Baltimore",
    where: "1=1",
    limit: 12000,
    map: (a, g): Property | null => {
      const address = s(a.Address);
      if (!address) return null;
      return {
        source: "vacant_building",
        source_listing_id: `balt-vbn-${s(a.NoticeNum) || s(a.BLOCKLOT) || address}`,
        title: `Vacant building · ${address}`,
        address,
        city: "Baltimore",
        state: "MD",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          vacant: true,
          code_violation: true,
          owner: s(a.OWNER_ABBR),
          status: "Vacant building notice",
        },
      };
    },
  },
  {
    // Seattle, WA — open code complaints & violations (~13k).
    source: "code_violation",
    api: "socrata",
    url: "https://cos-data.seattle.gov/resource/ez4a-iug7.json",
    state: "WA",
    city: "Seattle",
    where:
      "statuscurrent in ('Under Investigation','NOV Issued','Initiated','Warning','Citation Issued')",
    limit: 8000,
    map: (a, g): Property | null => {
      const address = s(a.originaladdress1);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `sea-${address}-${s(a.originalzip) || ""}`,
        title: `Code case · ${address}`,
        address,
        city: s(a.originalcity) || "Seattle",
        state: "WA",
        zip: s(a.originalzip),
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.statuscurrent) || "Open code case",
        },
      };
    },
  },
  {
    // Dallas, TX — open code violations incl. city liens (~14k). LIENHOLD = a filed city lien (strong).
    source: "code_violation",
    api: "socrata",
    url: "https://www.dallasopendata.com/resource/xrzj-c8ez.json",
    state: "TX",
    city: "Dallas",
    where: "status in ('OPEN','LIENHOLD')",
    limit: 10000,
    map: (a, g): Property | null => {
      const built = [
        s(a.str_num),
        s(a.str_prefix),
        s(a.str_nam),
        s(a.str_suffix),
      ]
        .filter(Boolean)
        .join(" ");
      const address =
        a.str_num && String(a.str_num) !== "0" ? built : s(a.str_nam);
      if (!address) return null;
      const geo = pointLatLng(a.the_geom);
      const lien = String(a.status).toUpperCase() === "LIENHOLD";
      return {
        source: "code_violation",
        source_listing_id: `dal-${address}-${s(a.zone) || ""}`,
        title: `${lien ? "City lien / " : ""}Code violation · ${address}`,
        address,
        city: "Dallas",
        state: "TX",
        zip: s(a.zone),
        lat: geo.lat,
        lng: geo.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: lien ? "City lien filed" : s(a.status) || "Open violation",
        },
      };
    },
  },
  {
    // Indianapolis (Marion Co), IN — open code enforcement / unsafe-building cases (~21k). Carries owner.
    source: "code_violation",
    api: "arcgis",
    url: "https://services.arcgis.com/tKsJAIiLjd90D5q2/arcgis/rest/services/Indianapolis_Code_Enforcement_Violations_and_Investigations_Geocoded/FeatureServer/0",
    state: "IN",
    city: "Indianapolis",
    where: "USER_CASE_STATUS NOT LIKE 'Closed%'",
    limit: 10000,
    map: (a, g): Property | null => {
      const address = s(a.USER_STREET_ADDRESS);
      if (!address) return null;
      const unsafe = /unsafe/i.test(String(a.USER_CASE_TYPE || ""));
      return {
        source: "code_violation",
        source_listing_id: `indy-${address}-${s(a.USER_ZIP) || ""}`,
        title: `${unsafe ? "Unsafe building / " : ""}Code case · ${address}`,
        address,
        city: s(a.USER_CITY) || "Indianapolis",
        state: "IN",
        zip: s(a.USER_ZIP),
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          owner: s(a.USER_OWNER),
          status: s(a.USER_CASE_STATUS) || "Open code case",
        },
      };
    },
  },
  {
    // Miami-Dade, FL — open/lien/referred code compliance violations (~31k).
    source: "code_violation",
    api: "arcgis",
    url: "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/CCVIOL_gdb/FeatureServer/0",
    state: "FL",
    city: "Miami",
    where:
      "STAT_DESC LIKE 'Open%' OR STAT_DESC LIKE 'Lien%' OR STAT_DESC LIKE 'Referred%'",
    limit: 12000,
    map: (a, g): Property | null => {
      const address = s(a.ADDRESS);
      if (!address) return null;
      const lien = /lien/i.test(String(a.STAT_DESC || ""));
      return {
        source: "code_violation",
        source_listing_id: `mdc-${s(a.FOLIO) || address}`,
        title: `${lien ? "Lien / " : ""}Code case · ${address}`,
        address,
        city: "Miami",
        state: "FL",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.STAT_DESC) || "Open code case",
        },
      };
    },
  },
  {
    // New Orleans, LA — pending sheriff sales / lien foreclosures (~440). No geometry → geocode by address.
    source: "foreclosure",
    api: "socrata",
    url: "https://data.nola.gov/resource/d52w-8nva.json",
    state: "LA",
    city: "New Orleans",
    where: "salestatus='Pending'",
    limit: 2000,
    map: (a, g): Property | null => {
      const address = s(a.propertyaddress);
      if (!address) return null;
      return {
        source: "foreclosure",
        source_listing_id: `nola-fc-${s(a.cdccasenumber) || address}`,
        title: `Sheriff sale · ${address}`,
        address,
        city: "New Orleans",
        state: "LA",
        lat: g.lat,
        lng: g.lng,
        price: n(a.saleamount),
        seller_type: "owner",
        signals: {
          foreclosure: true,
          sheriff_sale: true,
          owner: s(a.defendant),
          status: s(a.salestatus) || "Pending sheriff sale",
        },
      };
    },
  },
  {
    // Detroit (Wayne Co), MI — unpaid blight tickets since 2023 (~144k). Owner + MAILING address → doubles
    // as an absentee feed when the owner's state isn't MI (a core off-market list).
    source: "code_violation",
    api: "arcgis",
    url: "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/blight_tickets/FeatureServer/0",
    state: "MI",
    city: "Detroit",
    where: "amt_balance_due>0 AND ticket_issued_date>'2023-01-01'",
    limit: 15000,
    map: (a, g): Property | null => {
      const address = s(a.address);
      if (!address) return null;
      const ownerState = s(a.property_owner_state);
      const absentee = !!ownerState && ownerState.toUpperCase() !== "MI";
      return {
        source: absentee ? "absentee_owner" : "code_violation",
        source_listing_id: `det-blight-${address}-${s(a.zip_code) || ""}`,
        title: `${absentee ? "Absentee / " : ""}Blight ticket · ${address}`,
        address,
        city: "Detroit",
        state: "MI",
        zip: s(a.zip_code),
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          total_due: n(a.amt_balance_due),
          owner: s(a.property_owner_name),
          absentee,
          out_of_state_owner: absentee,
          owner_mailing: mailing(
            a.property_owner_address,
            a.property_owner_city,
            a.property_owner_state,
            a.property_owner_zip_code,
          ),
          status: "Unpaid blight ticket",
        },
      };
    },
  },
  {
    // Washington, DC — active vacant & blighted building designations (~2.1k).
    source: "vacant_building",
    api: "arcgis",
    url: "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/82",
    state: "DC",
    city: "Washington",
    where: "STATUS='ACTIVE'",
    limit: 4000,
    map: (a, g): Property | null => {
      const address = s(a.ADDRESS);
      if (!address) return null;
      return {
        source: "vacant_building",
        source_listing_id: `dc-vacant-${address}`,
        title: `Vacant / blighted · ${address}`,
        address,
        city: s(a.CITY) || "Washington",
        state: "DC",
        zip: s(a.ZIPCODE),
        lat: g.lat ?? coord(a.LATITUDE),
        lng: g.lng ?? coord(a.LONGITUDE),
        seller_type: "owner",
        signals: {
          vacant: true,
          code_violation: true,
          status: `Vacant/blighted (${s(a.RESIDENTIAL_TYPE) || "residential"})`,
        },
      };
    },
  },
  {
    // Cleveland (Cuyahoga Co), OH — open property-maintenance investigations (~3.2k). ADDRESS is
    // "street, CLEVELAND, OH, zip" → take the street part.
    source: "code_violation",
    api: "arcgis",
    url: "https://services3.arcgis.com/dty2kHktVXHrqO8i/arcgis/rest/services/Property_Maintenance_Investigations/FeatureServer/0",
    state: "OH",
    city: "Cleveland",
    where: "RECORD_STATUS NOT LIKE 'Closed%'",
    limit: 5000,
    map: (a, g): Property | null => {
      const full = s(a.ADDRESS);
      if (!full) return null;
      const address = full.split(",")[0].trim();
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `cle-${s(a.PARCEL_NUMBER) || full}`,
        title: `Code case · ${address}`,
        address,
        city: "Cleveland",
        state: "OH",
        lat: g.lat ?? coord(a.LAT),
        lng: g.lng ?? coord(a.LON),
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.RECORD_STATUS) || "Open investigation",
        },
      };
    },
  },
];

// ── Batch 2 (2026-07, curl-verified) — money-grade types: tax-delinquent + absentee (owner mailing). ──
const METRO_DISTRESS_SOURCES_2: OpenDataSource[] = [
  {
    // Houston / Harris County, TX — tax-delinquent suit list (owner + mailing + amount owed + market value).
    // The tax field name is date-stamped and rotates monthly → resolve it by pattern, not a fixed key.
    source: "tax_delinquent",
    api: "arcgis",
    url: "https://services5.arcgis.com/GtNPpPrhcOMhYgh4/arcgis/rest/services/Tax_Delinquent_Parcels/FeatureServer/0",
    state: "TX",
    city: "Houston",
    where: "1=1",
    limit: 5000,
    map: (a, g): Property | null => {
      const address =
        s(a.Address) ||
        [s(a.site_str_num), s(a.site_str_name)].filter(Boolean).join(" ");
      if (!address) return null;
      const taxKey = Object.keys(a).find((k) => /Tax_P_I/i.test(k));
      const ownerState = s(a.mail_state);
      const absentee = !!ownerState && ownerState.toUpperCase() !== "TX";
      return {
        source: "tax_delinquent",
        source_listing_id: `harris-td-${address}-${s(a.site_zip) || ""}`,
        title: `Tax-delinquent · ${address}`,
        address,
        city: s(a.site_city) || "Houston",
        state: "TX",
        zip: s(a.site_zip),
        lat: g.lat,
        lng: g.lng,
        price: n(a.total_market_val),
        seller_type: "owner",
        signals: {
          tax_delinquent: true,
          total_due: taxKey ? n(a[taxKey]) : undefined,
          market_value: n(a.total_market_val),
          owner: s(a.owner_name_1) || s(a.Owner),
          absentee,
          out_of_state_owner: absentee,
          owner_mailing: mailing(
            a.mail_addr_1,
            a.mail_city,
            a.mail_state,
            a.mail_zip,
          ),
          status: `Tax-delinquent (${s(a.Years_Due) || "multi-year"})`,
        },
      };
    },
  },
  {
    // Virginia Beach, VA — delinquent real-estate taxes (~18k). Table view (no geometry) → geocoded by address.
    source: "tax_delinquent",
    api: "arcgis",
    url: "https://services2.arcgis.com/CyVvlIiUfRBmMQuu/arcgis/rest/services/Delinquent_Real_Estate_Taxes_view/FeatureServer/0",
    state: "VA",
    city: "Virginia Beach",
    where: "Total_Delinquent_Amount_Due>0",
    limit: 9000,
    map: (a, g): Property | null => {
      const address = s(a.Situs_Address);
      if (!address) return null;
      return {
        source: "tax_delinquent",
        source_listing_id: `vabeach-td-${s(a.GPIN) || address}`,
        title: `Tax-delinquent · ${address}`,
        address,
        city: "Virginia Beach",
        state: "VA",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          tax_delinquent: true,
          total_due: n(a.Total_Delinquent_Amount_Due),
          owner: s(a.Owner_Name),
          status: `Tax-delinquent (${s(a.Tax_Year) || ""})`,
        },
      };
    },
  },
  {
    // Milwaukee, WI — non-owner-occupied residential with OUT-OF-STATE owner (~7.2k). Direct-mail ready.
    source: "absentee_owner",
    api: "arcgis",
    url: "https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/property/parcels_mprop/MapServer/8",
    state: "WI",
    city: "Milwaukee",
    where: "OWNER_CITY_STATE NOT LIKE '%WI%'",
    limit: 9000,
    map: (a, g): Property | null => {
      const address = s(a.ADDRESS);
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `mke-abs-${address}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: "Milwaukee",
        state: "WI",
        zip: s(a.GEO_ZIP_CODE),
        lat: g.lat,
        lng: g.lng,
        price: n(a.C_A_TOTAL),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OWNER_NAME_1),
          owner_mailing: mailing(
            a.OWNER_MAIL_ADDR,
            a.OWNER_CITY_STATE,
            a.OWNER_ZIP,
          ),
          market_value: n(a.C_A_TOTAL),
          status: `Absentee (${s(a.OWNER_CITY_STATE) || "out of state"})`,
        },
      };
    },
  },
  {
    // Atlanta / Fulton County, GA — residential parcels with OUT-OF-STATE owner (~1.1k). Direct-mail ready.
    source: "absentee_owner",
    api: "arcgis",
    url: "https://services5.arcgis.com/buITjRsK0rZsAXbQ/arcgis/rest/services/CurrentParcels/FeatureServer/0",
    state: "GA",
    city: "Atlanta",
    where: "OwnerAddr2 NOT LIKE '%GA%' AND LivUnits>0",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.Address);
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `fulton-abs-${address}-${s(a.ZipCode) || ""}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: "Atlanta",
        state: "GA",
        zip: s(a.ZipCode),
        lat: g.lat,
        lng: g.lng,
        price: n(a.TotAppr) || n(a.TotAssess),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.Owner),
          owner_mailing: mailing(a.OwnerAddr1, a.OwnerAddr2),
          market_value: n(a.TotAppr),
          status: `Absentee (${s(a.OwnerAddr2) || "out of state"})`,
        },
      };
    },
  },
  {
    // Charlotte / Mecklenburg County, NC — open code-enforcement cases (~3.2k). FullAddress = "ST … CHARLOTTE, NC".
    source: "code_violation",
    api: "arcgis",
    url: "https://gis.charlottenc.gov/arcgis/rest/services/HNS/CodeEnforcementCasesAll/MapServer/0",
    state: "NC",
    city: "Charlotte",
    where: "CaseStatus='Open'",
    limit: 4000,
    map: (a, g): Property | null => {
      const full = s(a.FullAddress);
      if (!full) return null;
      const address = full.replace(/\s+CHARLOTTE,?\s*NC.*$/i, "").trim();
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `clt-${s(a.CaseNumber) || s(a.ParcelId) || full}`,
        title: `Code case · ${address}`,
        address,
        city: "Charlotte",
        state: "NC",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.CaseType) || "Open code case",
        },
      };
    },
  },
  {
    // Columbus / Franklin County, OH — active building/zoning code cases.
    source: "code_violation",
    api: "arcgis",
    url: "https://maps2.columbus.gov/arcgis/rest/services/Schemas/BuildingZoning/MapServer/23",
    state: "OH",
    city: "Columbus",
    where: "B1_APPL_STATUS NOT IN ('Closed')",
    limit: 8000,
    map: (a, g): Property | null => {
      const address = s(a.SITE_ADDRESS);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `cbus-${s(a.B1_PARCEL_NBR) || address}`,
        title: `Code case · ${address}`,
        address,
        city: "Columbus",
        state: "OH",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.B1_APPL_STATUS) || "Open code case",
        },
      };
    },
  },
  {
    // Nashville / Davidson County, TN — open property-standards violations (~3.3k). Carries owner + lat/lon.
    source: "code_violation",
    api: "arcgis",
    url: "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Property_Standards_Violations_2/FeatureServer/0",
    state: "TN",
    city: "Nashville",
    where: "Status='Open'",
    limit: 4000,
    map: (a, g): Property | null => {
      const address = s(a.Property_Address);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `nash-${address}-${s(a.ZIP) || ""}`,
        title: `Code violation · ${address}`,
        address,
        city: s(a.City) || "Nashville",
        state: "TN",
        zip: s(a.ZIP),
        lat: g.lat ?? coord(a.Lat),
        lng: g.lng ?? coord(a.Lon),
        seller_type: "owner",
        signals: {
          code_violation: true,
          owner: s(a.Property_Owner),
          status: "Open property-standards violation",
        },
      };
    },
  },
  {
    // Louisville / Jefferson County, KY — open building-code enforcement cases (~3.6k). Table → geocoded.
    source: "code_violation",
    api: "arcgis",
    url: "https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/Louisville_Metro_KY_Building_Code_Permit_Enforcement_Cases/FeatureServer/0",
    state: "KY",
    city: "Louisville",
    where: "STATUS='Open' AND STREETADDRESS<>' '",
    limit: 4000,
    map: (a, g): Property | null => {
      const address = s(a.STREETADDRESS);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `lou-${address}-${s(a.ZIP) || ""}`,
        title: `Code case · ${address}`,
        address,
        city: s(a.CITY) || "Louisville",
        state: "KY",
        zip: s(a.ZIP),
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.CASETYPE) || "Open code case",
        },
      };
    },
  },
];

// ── Batch 3 (2026-07, curl-verified) — West Coast + Mountain + more TX/FL, incl. the first CKAN feeds. ──
const METRO_DISTRESS_SOURCES_3: OpenDataSource[] = [
  {
    // Broward County (Fort Lauderdale), FL — out-of-state owners on the property-appraiser taxroll (~32k).
    source: "absentee_owner",
    api: "arcgis",
    url: "https://services.arcgis.com/JMAJrTsHNLrSsWf5/arcgis/rest/services/PARCEL_POLY_BCPA_TAXROLL/FeatureServer/0",
    state: "FL",
    city: "Broward County",
    where:
      "STATE<>'FL' AND STATE IS NOT NULL AND SITUS_STREET_NAME IS NOT NULL",
    limit: 15000,
    map: (a, g): Property | null => {
      const address = [
        s(a.SITUS_STREET_NUMBER),
        s(a.SITUS_STREET_DIRECTION),
        s(a.SITUS_STREET_NAME),
        s(a.SITUS_STREET_TYPE),
      ]
        .filter(Boolean)
        .join(" ");
      if (!address) return null;
      const mv = (n(a.JUST_LAND_VALUE) || 0) + (n(a.JUST_BUILDING_VALUE) || 0);
      return {
        source: "absentee_owner",
        source_listing_id: `broward-abs-${address}-${s(a.SITUS_ZIP_CODE) || ""}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: s(a.SITUS_CITY) || "Broward County",
        state: "FL",
        zip: s(a.SITUS_ZIP_CODE),
        lat: g.lat,
        lng: g.lng,
        price: mv || undefined,
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.NAME_LINE_1),
          owner_mailing: mailing(a.ADDRESS_LINE_1, a.CITY, a.STATE, a.ZIP),
          market_value: mv || undefined,
          status: `Absentee (${s(a.STATE) || "out of state"})`,
        },
      };
    },
  },
  {
    // San Francisco, CA — active DBI notices of violation (~30k).
    source: "code_violation",
    api: "socrata",
    url: "https://data.sfgov.org/resource/nbtm-fbw5.json",
    state: "CA",
    city: "San Francisco",
    where: "status='active'",
    limit: 12000,
    map: (a, g): Property | null => {
      const address = [s(a.street_number), s(a.street_name), s(a.street_suffix)]
        .filter(Boolean)
        .join(" ");
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `sf-${s(a.block) || ""}-${s(a.lot) || ""}-${address}`,
        title: `Code violation · ${address}`,
        address,
        city: "San Francisco",
        state: "CA",
        zip: s(a.zipcode),
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.nov_category_description) || "Active violation",
        },
      };
    },
  },
  {
    // Portland / Multnomah County, OR — out-of-state owners on the BDS property roll (~28k).
    source: "absentee_owner",
    api: "arcgis",
    url: "https://www.portlandmaps.com/arcgis/rest/services/Public/BDS_Property/MapServer/0",
    state: "OR",
    city: "Portland",
    where:
      "OWNER_MAILING_ADDRESS NOT LIKE '% OR %' AND OWNER_MAILING_ADDRESS IS NOT NULL AND OWNER_MAILING_ADDRESS<>'' AND ADDRESS_SITUS IS NOT NULL",
    limit: 12000,
    map: (a, g): Property | null => {
      const address = s(a.ADDRESS_SITUS);
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `pdx-abs-${address}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: "Portland",
        state: "OR",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OWNER_NAME),
          owner_mailing: s(a.OWNER_MAILING_ADDRESS),
          status: "Absentee (out of state)",
        },
      };
    },
  },
  {
    // Pittsburgh (Allegheny Co), PA — city tax-delinquent list (~26k). CKAN datastore → geocoded by address.
    source: "tax_delinquent",
    api: "ckan",
    url: "https://data.wprdc.org",
    resourceId: "ed0d1550-c300-4114-865c-82dc7c23235b",
    state: "PA",
    city: "Pittsburgh",
    where: "current_delq_tax>0",
    limit: 15000,
    map: (a, g): Property | null => {
      const address = s(a.address);
      if (!address) return null;
      return {
        source: "tax_delinquent",
        source_listing_id: `pgh-td-${s(a.pin) || address}`,
        title: `Tax-delinquent · ${address}`,
        address,
        city: "Pittsburgh",
        state: "PA",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          tax_delinquent: true,
          total_due: n(a.current_delq_tax),
          status: `Tax-delinquent${a.prior_years ? ` (${s(a.prior_years)} prior yrs)` : ""}`,
        },
      };
    },
  },
  {
    // Minneapolis / Hennepin County, MN — tax-delinquent parcels (~3.4k). Carries owner + market value.
    source: "tax_delinquent",
    api: "arcgis",
    url: "https://gis.hennepin.us/arcgis/rest/services/HennepinData/LAND_PROPERTY/MapServer/1",
    state: "MN",
    city: "Minneapolis",
    where: "EARLIEST_DELQ_YR>'2000'",
    limit: 6000,
    map: (a, g): Property | null => {
      const address = [s(a.HOUSE_NO), s(a.STREET_NM)].filter(Boolean).join(" ");
      if (!address) return null;
      const due = (n(a.TAX_TOT) || 0) - (n(a.NET_TAX_PD) || 0);
      return {
        source: "tax_delinquent",
        source_listing_id: `hennepin-td-${address}-${s(a.ZIP_CD) || ""}`,
        title: `Tax-delinquent · ${address}`,
        address,
        city: s(a.MAILING_MUNIC_NM) || "Minneapolis",
        state: "MN",
        zip: s(a.ZIP_CD),
        lat: g.lat ?? coord(a.LAT),
        lng: g.lng ?? coord(a.LON),
        price: n(a.MKT_VAL_TOT),
        seller_type: "owner",
        signals: {
          tax_delinquent: true,
          total_due: due > 0 ? due : undefined,
          market_value: n(a.MKT_VAL_TOT),
          owner: s(a.OWNER_NM) || s(a.TAXPAYER_NM),
          status: `Tax-delinquent (since 20${s(a.EARLIEST_DELQ_YR) || "??"})`,
        },
      };
    },
  },
  {
    // Tacoma / Pierce County, WA — open code violations (~700). Service name has a literal space (%20).
    source: "code_violation",
    api: "arcgis",
    url: "https://services3.arcgis.com/SCwJH1pD8WSn5T5y/ArcGIS/rest/services/Code%20Violations/FeatureServer/0",
    state: "WA",
    city: "Tacoma",
    where: "casestatus NOT LIKE 'Closed%'",
    limit: 3000,
    map: (a, g): Property | null => {
      const address = s(a.address);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `tac-${s(a.parcelnumber) || address}`,
        title: `Code case · ${address}`,
        address,
        city: "Tacoma",
        state: "WA",
        lat: g.lat ?? coord(a.latitude),
        lng: g.lng ?? coord(a.longitude),
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.casetype) || "Open code case",
        },
      };
    },
  },
  {
    // Sacramento, CA — vacant-lot / nuisance program (~4.8k).
    source: "vacant_building",
    api: "arcgis",
    url: "https://services5.arcgis.com/54falWtcpty3V47Z/ArcGIS/rest/services/Vacant_Lot_Program/FeatureServer/0",
    state: "CA",
    city: "Sacramento",
    where: "ADDRESS IS NOT NULL",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.ADDRESS);
      if (!address) return null;
      return {
        source: "vacant_building",
        source_listing_id: `sac-vac-${s(a.APN) || address}`,
        title: `Vacant lot · ${address}`,
        address,
        city: "Sacramento",
        state: "CA",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          vacant: true,
          status: s(a.CASE_STATUS)
            ? `Vacant lot (${s(a.CASE_STATUS)})`
            : "Vacant lot program",
        },
      };
    },
  },
  {
    // Austin / Travis County, TX — active code violations (~3.4k).
    source: "code_violation",
    api: "socrata",
    url: "https://data.austintexas.gov/resource/6wtj-zbtb.json",
    state: "TX",
    city: "Austin",
    where: "status='Active'",
    limit: 4000,
    map: (a, g): Property | null => {
      const address =
        s(a.address) ||
        [s(a.house_number), s(a.street_name)].filter(Boolean).join(" ");
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `atx-${s(a.parcelid) || address}`,
        title: `Code case · ${address}`,
        address,
        city: s(a.city) || "Austin",
        state: "TX",
        zip: s(a.zip_code),
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.case_type) || "Active code case",
        },
      };
    },
  },
  {
    // Boston / Suffolk County, MA — out-of-state owners on the assessment roll (~8k). CKAN (quoted, case-
    // sensitive columns) → geocoded by address.
    source: "absentee_owner",
    api: "ckan",
    url: "https://data.boston.gov",
    resourceId: "ee73430d-96c0-423e-ad21-c4cfb54c8961",
    state: "MA",
    city: "Boston",
    where: `"OWN_OCC"='N' AND "MAIL_STATE"<>'MA'`,
    limit: 9000,
    map: (a, g): Property | null => {
      const address = [s(a.ST_NUM), s(a.ST_NAME)].filter(Boolean).join(" ");
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `boston-abs-${address}-${s(a.ZIP_CODE) || ""}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: s(a.CITY) || "Boston",
        state: "MA",
        zip: s(a.ZIP_CODE),
        lat: g.lat,
        lng: g.lng,
        price: n(a.TOTAL_VALUE),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OWNER),
          owner_mailing: mailing(
            a.MAIL_STREET_ADDRESS,
            a.MAIL_CITY,
            a.MAIL_STATE,
            a.MAIL_ZIP_CODE,
          ),
          market_value: n(a.TOTAL_VALUE),
          status: `Absentee (${s(a.MAIL_STATE) || "out of state"})`,
        },
      };
    },
  },
];

// ── Batch 4 (2026-07, curl-verified) — remaining big metros; heavy on full-county absentee rolls. ──
const METRO_DISTRESS_SOURCES_4: OpenDataSource[] = [
  {
    // Jacksonville / Duval County, FL — out-of-state owners on the full county parcel roll (~40k). Standout.
    source: "absentee_owner",
    api: "arcgis",
    url: "https://maps.coj.net/coj/rest/services/CityBiz/Parcels/MapServer/0",
    state: "FL",
    city: "Jacksonville",
    where: "MAILSTATE NOT IN ('FL') AND MAILSTATE IS NOT NULL",
    limit: 15000,
    map: (a, g): Property | null => {
      const address = [
        s(a.STREET_NO),
        s(a.ST_DIR),
        s(a.ST_NAME) || s(a.SAINT_NAME),
        s(a.ST_TYPE),
      ]
        .filter(Boolean)
        .join(" ");
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `duval-abs-${address}-${s(a.ZIPCODE) || ""}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: s(a.ADDRCITY) || "Jacksonville",
        state: "FL",
        zip: s(a.ZIPCODE),
        lat: g.lat ?? coord(a.LAT),
        lng: g.lng ?? coord(a.LONG),
        price: n(a.CAMA_VAL),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.LNAMEOWNER),
          owner_mailing: mailing(
            a.MAILADDR1,
            a.MAILCITY,
            a.MAILSTATE,
            a.MAILZIP,
          ),
          market_value: n(a.CAMA_VAL),
          status: `Absentee (${s(a.MAILSTATE) || "out of state"})`,
        },
      };
    },
  },
  {
    // Fort Worth / Tarrant County, TX — open code violations (~12k).
    source: "code_violation",
    api: "arcgis",
    url: "https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/Code_Violations_Experience_Builder/MapServer/4",
    state: "TX",
    city: "Fort Worth",
    where: "Case_Current_Status='Open'",
    limit: 10000,
    map: (a, g): Property | null => {
      const address = s(a.Address);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `ftw-${address}-${s(a.ZipCode) || ""}`,
        title: `Code case · ${address}`,
        address,
        city: s(a.City) || "Fort Worth",
        state: "TX",
        zip: s(a.ZipCode),
        lat: g.lat ?? coord(a.Latitude),
        lng: g.lng ?? coord(a.Longitude),
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.Complaint_Type_Description) || "Open code case",
        },
      };
    },
  },
  {
    // St Paul / Ramsey County, MN — registered vacant/condemned buildings (~380).
    source: "vacant_building",
    api: "arcgis",
    url: "https://services1.arcgis.com/9meaaHE3uiba0zr8/arcgis/rest/services/VacantBuildings/FeatureServer/0",
    state: "MN",
    city: "Saint Paul",
    where: "1=1",
    limit: 2000,
    map: (a, g): Property | null => {
      const address = s(a.ADDRESS);
      if (!address) return null;
      return {
        source: "vacant_building",
        source_listing_id: `stpaul-vac-${s(a.PIN) || address}`,
        title: `Vacant building · ${address}`,
        address,
        city: "Saint Paul",
        state: "MN",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          vacant: true,
          status: `Vacant (cat ${s(a.VB_CATEGORY) || "?"}, since ${s(a.VACANT_AS_OF) || "?"})`,
        },
      };
    },
  },
  {
    // Rochester, NY — vacant-land parcels; flags out-of-town owners as absentee.
    source: "vacant_building",
    api: "arcgis",
    url: "https://maps.cityofrochester.gov/server/rest/services/Open_Data/Tax_Parcels_Vacant_Land_Open_Data/FeatureServer/3",
    state: "NY",
    city: "Rochester",
    where: "1=1",
    limit: 5000,
    map: (a, g): Property | null => {
      const address = s(a.SITEADDRESS);
      if (!address) return null;
      const pcity = String(a.PSTLCITY || "").toUpperCase();
      const absentee = !!pcity && !pcity.includes("ROCHESTER");
      return {
        source: absentee ? "absentee_owner" : "vacant_building",
        source_listing_id: `roc-${address}-${s(a.ZIP5) || ""}`,
        title: `${absentee ? "Absentee / " : ""}Vacant land · ${address}`,
        property_type: "land",
        address,
        city: s(a.CITY) || "Rochester",
        state: "NY",
        zip: s(a.ZIP5),
        lat: g.lat,
        lng: g.lng,
        price: n(a.CURRENT_TOTAL_VALUE),
        seller_type: "owner",
        signals: {
          vacant: true,
          absentee,
          owner: s(a.OWNERNME1),
          owner_mailing: mailing(a.PSTLADDRESS, a.PSTLCITY),
          market_value: n(a.CURRENT_TOTAL_VALUE),
          status: absentee ? `Absentee vacant land` : "Vacant land",
        },
      };
    },
  },
  {
    // Orlando / Orange County, FL — active code violations (~2k). Layer is pre-filtered to active.
    source: "code_violation",
    api: "arcgis",
    url: "https://ocgis4.ocfl.net/arcgis/rest/services/AGOL_Open_Data/MapServer/53",
    state: "FL",
    city: "Orlando",
    where: "1=1",
    limit: 3000,
    map: (a, g): Property | null => {
      const address =
        s(a.CE_COMPLETE_ADDRESS) ||
        [s(a.CE_LOC_ST_NUM), s(a.CE_LOC_ST_NAME), s(a.CE_LOC_ST_TYP)]
          .filter(Boolean)
          .join(" ");
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `orl-${s(a.CE_OFFICIAL_PARCEL_ID) || address}`,
        title: `Code case · ${address}`,
        address,
        city: "Orlando",
        state: "FL",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          owner: s(a.NAME_NAME),
          status: s(a.INCI_TYP) || "Active violation",
        },
      };
    },
  },
  {
    // Tucson / Pima County, AZ — open code violations (~6.4k).
    source: "code_violation",
    api: "arcgis",
    url: "https://gis.tucsonaz.gov/arcgis/rest/services/PDSD/pdsdMain_General5/MapServer/94",
    state: "AZ",
    city: "Tucson",
    where: "DT_CLSD IS NULL OR DT_CLSD=''",
    limit: 6000,
    map: (a, g): Property | null => {
      const address = s(a.ADDRESSFULL);
      if (!address) return null;
      return {
        source: "code_violation",
        source_listing_id: `tuc-${address}`,
        title: `Code case · ${address}`,
        address,
        city: "Tucson",
        state: "AZ",
        lat: g.lat,
        lng: g.lng,
        seller_type: "owner",
        signals: {
          code_violation: true,
          status: s(a.TYPE_DESC) || "Open code case",
        },
      };
    },
  },
  {
    // San Jose / Santa Clara County, CA — out-of-state owners on the parcel layer.
    source: "absentee_owner",
    api: "arcgis",
    url: "https://services3.arcgis.com/JAU7IM34hqT9y9ew/arcgis/rest/services/Parcels/FeatureServer/0",
    state: "CA",
    city: "San Jose",
    where:
      "MAILSTATE NOT IN ('CA') AND MAILSTATE IS NOT NULL AND MAILSTATE<>''",
    limit: 3000,
    map: (a, g): Property | null => {
      const address = s(a.SiteAddressFull);
      if (!address) return null;
      const mv = (n(a.LAND) || 0) + (n(a.IMPROVEMENT) || 0);
      return {
        source: "absentee_owner",
        source_listing_id: `sccl-abs-${s(a.APN) || address}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: s(a.SITUS_CITY_NAME) || "San Jose",
        state: "CA",
        zip: s(a.SITUSZIP),
        lat: g.lat,
        lng: g.lng,
        price: mv || undefined,
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.ASSESSEE),
          owner_mailing: mailing(
            a.MAILING_ADDRESS,
            a.MAILCITY,
            a.MAILSTATE,
            a.MAILZIP,
          ),
          market_value: mv || undefined,
          status: `Absentee (${s(a.MAILSTATE) || "out of state"})`,
        },
      };
    },
  },
  {
    // Tampa / Hillsborough County, FL — out-of-state owners (HCPA roll subset).
    source: "absentee_owner",
    api: "arcgis",
    url: "https://services.arcgis.com/04HiymDgLlsbhaV4/arcgis/rest/services/Final_Roll_HCPA_2025/FeatureServer/42",
    state: "FL",
    city: "Tampa",
    where: "STATE NOT IN ('FL') AND STATE IS NOT NULL AND STATE<>''",
    limit: 3000,
    map: (a, g): Property | null => {
      const address = s(a.SITE_ADDR);
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `hills-abs-${s(a.FOLIO) || address}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: s(a.SITE_CITY) || "Tampa",
        state: "FL",
        zip: s(a.SITE_ZIP),
        lat: g.lat,
        lng: g.lng,
        price: n(a.JUST),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OWNER),
          owner_mailing: mailing(a.ADDR_1, a.CITY, a.STATE, a.ZIP),
          market_value: n(a.JUST),
          status: `Absentee (${s(a.STATE) || "out of state"})`,
        },
      };
    },
  },
  {
    // Albuquerque / Bernalillo County, NM — out-of-state owners (assessor layer 2, subset).
    source: "absentee_owner",
    api: "arcgis",
    url: "https://services6.arcgis.com/NiLPE6S5bwjCDk9X/arcgis/rest/services/Assessor_Parcels/FeatureServer/2",
    state: "NM",
    city: "Albuquerque",
    where: "OWNSTATE NOT IN ('NM') AND OWNSTATE IS NOT NULL",
    limit: 2000,
    map: (a, g): Property | null => {
      const address = s(a.SITUSADD);
      if (!address) return null;
      return {
        source: "absentee_owner",
        source_listing_id: `abq-abs-${address}-${s(a.SITUSZIP) || ""}`,
        title: `Absentee owner · ${address}`,
        property_type: "single_family",
        address,
        city: "Albuquerque",
        state: "NM",
        zip: s(a.SITUSZIP),
        lat: g.lat,
        lng: g.lng,
        price: n(a.TOTVALUE),
        seller_type: "owner",
        signals: {
          absentee: true,
          out_of_state_owner: true,
          owner: s(a.OWNER),
          owner_mailing: mailing(a.OWNADD, a.OWNCITY, a.OWNSTATE, a.OWNZIPCODE),
          market_value: n(a.TOTVALUE),
          status: `Absentee (${s(a.OWNSTATE) || "out of state"})`,
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
  ...METRO_DISTRESS_SOURCES,
  ...METRO_DISTRESS_SOURCES_2,
  ...METRO_DISTRESS_SOURCES_3,
  ...METRO_DISTRESS_SOURCES_4,
];

/** Harvest all configured open-data off-market leads (Missouri-first; whole-US as configs are added). */
export function fetchOpenDataLeads(
  sources: OpenDataSource[] = OPEN_DATA_SOURCES,
): Promise<Property[]> {
  return fetchOpenDataSources(sources);
}
