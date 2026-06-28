export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { harvestGovDealsProperties } from "@/lib/housing/sources/govdeals-property";
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
    // GovDeals + AllSurplus residential real estate (both free, same maestro engine).
    const [gd, ad] = await Promise.all([
      harvestGovDealsProperties("GD", 5),
      harvestGovDealsProperties("AD", 3).catch(() => []),
    ]);
    const properties = [...gd, ...ad];
    const written = await upsertProperties(properties);

    return NextResponse.json({
      ok: true,
      harvested: properties.length,
      written: written < 0 ? 0 : written,
      tableMissing: written === -1,
      sources: { govdeals: gd.length, allsurplus: ad.length },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
