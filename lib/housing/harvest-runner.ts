// lib/housing/harvest-runner.ts
//
// The single, reusable HomeIQ harvest — every free housing source → score/geocode → upsert into the
// `properties` table. Extracted so it can run BOTH from the API route (/api/homeiq/harvest) AND, more
// importantly, from the BullMQ worker on the always-on Docker box (no serverless timeout, with retries).
// Each source is isolated (.catch → []) so one dead feed never sinks the run.

import { harvestGovDealsProperties } from "./sources/govdeals-property";
import { scrapeHudHomes } from "./sources/hud-homes";
import { scrapeHomeSteps } from "./sources/homesteps";
import { scrapeAuctionCom } from "./sources/auctioncom";
import { scrapeGsaRealEstate } from "./sources/gsa-realestate";
import { harvestRedfinGis } from "./sources/redfin-gis";
import { harvestHomePath } from "./sources/homepath";
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
import { harvestReso } from "./sources/reso";
import { enrichRedfinProperties } from "./sources/redfin-enrich";
import { upsertProperties, reconcileStaleProperties } from "./store";
import { loadLivePsf, refreshMarketTemp } from "./live-psf";
import { loadCalibration } from "./calibration";
import { enrichFloodZones } from "./flood-enrich";
import { scrapeFsbo } from "./sources/fsbo";
import { scrapeHubzu } from "./sources/hubzu";
import { scrapeBid4Assets } from "./sources/bid4assets";
import { scrapeUsdaResales } from "./sources/usda-resales";

export interface HarvestResult {
  ok: boolean;
  harvested: number;
  written: number;
  tableMissing: boolean;
  sources: Record<string, number>;
}

/** Run the full housing harvest: all free sources in parallel, then upsert. Safe to call anywhere. */
export async function runHousingHarvest(): Promise<HarvestResult> {
  // Inject our own live SOLD $/sqft into arv-psf BEFORE scoring, so every lead's ARV/equity uses the
  // freshest comps we've harvested (falls back to the static snapshot per-ZIP where we have none yet).
  await loadLivePsf().catch(() => {});
  // Inject the learned tier calibration (realized pipeline outcomes) before scoring too — no-op until
  // enough deals have been closed/killed, then stored scores start reflecting what actually converts.
  await loadCalibration().catch(() => {});
  const [
    gd,
    ad,
    hud,
    homesteps,
    auctioncom,
    gsare,
    redfin,
    homepath,
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
    mls,
    fsbo,
    hubzu,
    b4a,
    usda,
  ] = await Promise.all([
    harvestGovDealsProperties("GD", 5).catch(() => []),
    harvestGovDealsProperties("AD", 3).catch(() => []),
    scrapeHudHomes().catch(() => []),
    scrapeHomeSteps().catch(() => []),
    scrapeAuctionCom().catch(() => []),
    scrapeGsaRealEstate().catch(() => []),
    harvestRedfinGis().catch(() => []), // verified open MLS door: gis-csv bbox, no anti-bot
    harvestHomePath().catch(() => []), // Fannie Mae REO — open JSON, nationwide bank-owned
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
    harvestReso().catch(() => []), // MLS via RESO Web API (legit; [] until a member feed is wired)
    scrapeFsbo().catch(() => []), // FSBO.com national owner listings (open JSON API, no auth)
    scrapeHubzu().catch(() => []), // Hubzu.com REO/foreclosure auctions (open JSON API, XSSI-prefixed)
    scrapeBid4Assets().catch(() => []), // Bid4Assets.com tax/REO auctions (open JSON API with CSRF token)
    scrapeUsdaResales().catch(() => []), // USDA RD/FSA surplus resales (FIPS state crawling, no auth)
  ]);

  let properties = [
    ...gd,
    ...ad,
    ...hud,
    ...homesteps,
    ...auctioncom,
    ...gsare,
    ...redfin,
    ...homepath,
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
    ...mls,
    ...fsbo,
    ...hubzu,
    ...b4a,
    ...usda,
  ];

  // Opt-in per-listing enrichment (REDFIN_ENRICH=1, fleet-only): pull listing remarks/photos for the
  // hottest Redfin leads so the distress scorer + rehab inference read real wording. Bounded + safe — every
  // fetch returns null off-fleet, leaving leads untouched.
  if (process.env.REDFIN_ENRICH === "1") {
    properties = await enrichRedfinProperties(properties).catch(
      () => properties,
    );
  }

  const written = await upsertProperties(properties);

  // Refresh the market-temperature half of the live index (active count / DOM / asking $/sqft) from the
  // listings we just pulled — no extra fetch, feeds the user-facing "market temp" (never ARV).
  if (written > 0) await refreshMarketTemp(properties).catch(() => 0);

  // Freshness: retire listings not re-seen in 21 days (sold/delisted) so counts stay truthful. Only after a
  // healthy harvest (written > 0) — never prune on an empty/failed run that could wrongly retire everything.
  if (written > 0) await reconcileStaleProperties(21).catch(() => 0);

  // Enrich a bounded, hottest-first batch with FEMA flood zones (static per parcel, stored once) so flood
  // risk becomes a filter/badge — accumulates full coverage across harvests. Best-effort; never blocks.
  if (written > 0) await enrichFloodZones(800).catch(() => 0);

  return {
    ok: true,
    harvested: properties.length,
    written: written < 0 ? 0 : written,
    tableMissing: written === -1,
    sources: {
      govdeals: gd.length,
      allsurplus: ad.length,
      hud: hud.length,
      homesteps: homesteps.length,
      auctioncom: auctioncom.length,
      gsa_realestate: gsare.length,
      redfin: redfin.length,
      fannie_homepath: homepath.length,
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
      mls: mls.length,
      fsbo: fsbo.length,
      hubzu: hubzu.length,
      bid4assets: b4a.length,
      usda_resales: usda.length,
    },
  };
}
