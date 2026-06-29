export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { harvestGovDealsProperties } from "@/lib/housing/sources/govdeals-property";
import { scrapeHudHomes } from "@/lib/housing/sources/hud-homes";
import { scrapeGsaRealEstate } from "@/lib/housing/sources/gsa-realestate";
import { scrapeRedfin } from "@/lib/housing/sources/redfin";
import { scrapePublicSurplusProperties } from "@/lib/housing/sources/publicsurplus-property";
import { scrapeMunicibidProperties } from "@/lib/housing/sources/municibid-property";
import { scrapeDetroitLandBank } from "@/lib/housing/sources/detroit-landbank";
import { scrapeCuyahogaLandBank } from "@/lib/housing/sources/cuyahoga-landbank";
import { scrapeGeneseeLandBank } from "@/lib/housing/sources/genesee-landbank";
import { scrapeLucasLandBank } from "@/lib/housing/sources/lucas-landbank";
import { fetchPhillyTaxDelinquent } from "@/lib/housing/sources/tax-delinquent";
import { fetchPhillyCodeViolations } from "@/lib/housing/sources/code-violations";
import { fetchOpenDataLeads } from "@/lib/housing/sources/open-data-sources";
import { harvestPortals } from "@/lib/housing/sources/portals";
import { upsertProperties } from "@/lib/housing/store";

// POST /api/homeiq/harvest — refresh the HomeIQ `properties` table from the free sources. Called by the
// fleet/cron (the housing analogue of the cars scrape). Secret-gated: Authorization: Bearer <SCRAPE_SECRET
// | CRON_SECRET>. Secure-by-default — disabled until a secret is set.

function denyUnauthed(req: NextRequest): NextResponse | null {
  const secret = process.env.SCRAPE_SECRET || process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Harvest disabled: set SCRAPE_SECRET or CRON_SECRET" },
      { status: 503 },
    );
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export async function POST(req: NextRequest) {
  const denied = denyUnauthed(req);
  if (denied) return denied;

  try {
    // Free housing sources: GovDeals + AllSurplus (maestro) + HUD Homes (rich data: sqft/beds → MAO).
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
      harvestGovDealsProperties("GD", 5),
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
      fetchPhillyTaxDelinquent(2000).catch(() => []), // off-market tax-delinquent owners
      fetchPhillyCodeViolations(1500).catch(() => []), // open code-violation / vacant owners
      fetchOpenDataLeads().catch(() => []), // generic open-data registry (Missouri-first, US rollout)
      harvestPortals().catch(() => []), // Zillow/Realtor/Homes/Movoto/Trulia (fleet-gated, config-driven)
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

    return NextResponse.json({
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
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
