// lib/housing/harvest-runner.ts
//
// The single, reusable HomeIQ harvest — every free housing source → score/geocode → upsert into the
// `properties` table. Extracted so it can run BOTH from the API route (/api/homeiq/harvest) AND, more
// importantly, from the BullMQ worker on the always-on Docker box (no serverless timeout, with retries).
// Each source is isolated (.catch → []) so one dead feed never sinks the run.

import { harvestGovDealsProperties } from "./sources/govdeals-property";
import { scrapeHudHomes } from "./sources/hud-homes";
import { scrapeGsaRealEstate } from "./sources/gsa-realestate";
import { scrapeRedfin } from "./sources/redfin";
import { scrapePublicSurplusProperties } from "./sources/publicsurplus-property";
import { scrapeMunicibidProperties } from "./sources/municibid-property";
import { scrapeDetroitLandBank } from "./sources/detroit-landbank";
import { scrapeCuyahogaLandBank } from "./sources/cuyahoga-landbank";
import { scrapeGeneseeLandBank } from "./sources/genesee-landbank";
import { scrapeLucasLandBank } from "./sources/lucas-landbank";
import { fetchPhillyTaxDelinquent } from "./sources/tax-delinquent";
import { fetchPhillyCodeViolations } from "./sources/code-violations";
import { fetchOpenDataLeads } from "./sources/open-data-sources";
import { harvestPortals } from "./sources/portals";
import { upsertProperties } from "./store";

export interface HarvestResult {
  ok: boolean;
  harvested: number;
  written: number;
  tableMissing: boolean;
  sources: Record<string, number>;
}

/** Run the full housing harvest: all free sources in parallel, then upsert. Safe to call anywhere. */
export async function runHousingHarvest(): Promise<HarvestResult> {
  const [
    gd,
    ad,
    hud,
    gsare,
    redfin,
    psre,
    mbre,
    dlb,
    cclb,
    genlb,
    luclb,
    txd,
    civ,
    od,
    portals,
  ] = await Promise.all([
    harvestGovDealsProperties("GD", 5).catch(() => []),
    harvestGovDealsProperties("AD", 3).catch(() => []),
    scrapeHudHomes().catch(() => []),
    scrapeGsaRealEstate().catch(() => []),
    scrapeRedfin().catch(() => []), // fleet-only (PerimeterX); [] elsewhere
    scrapePublicSurplusProperties().catch(() => []),
    scrapeMunicibidProperties().catch(() => []),
    scrapeDetroitLandBank().catch(() => []),
    scrapeCuyahogaLandBank().catch(() => []),
    scrapeGeneseeLandBank().catch(() => []),
    scrapeLucasLandBank().catch(() => []),
    fetchPhillyTaxDelinquent(2000).catch(() => []),
    fetchPhillyCodeViolations(1500).catch(() => []),
    fetchOpenDataLeads().catch(() => []), // generic open-data registry (nationwide off-market)
    harvestPortals().catch(() => []), // Zillow/Realtor/… (fleet-gated, config-driven)
  ]);

  const properties = [
    ...gd,
    ...ad,
    ...hud,
    ...gsare,
    ...redfin,
    ...psre,
    ...mbre,
    ...dlb,
    ...cclb,
    ...genlb,
    ...luclb,
    ...txd,
    ...civ,
    ...od,
    ...portals,
  ];
  const written = await upsertProperties(properties);

  return {
    ok: true,
    harvested: properties.length,
    written: written < 0 ? 0 : written,
    tableMissing: written === -1,
    sources: {
      govdeals: gd.length,
      allsurplus: ad.length,
      hud: hud.length,
      gsa_realestate: gsare.length,
      redfin: redfin.length,
      publicsurplus: psre.length,
      municibid: mbre.length,
      detroit_landbank: dlb.length,
      cuyahoga_landbank: cclb.length,
      genesee_landbank: genlb.length,
      lucas_landbank: luclb.length,
      tax_delinquent: txd.length,
      code_violation: civ.length,
      open_data: od.length,
      portals: portals.length,
    },
  };
}
