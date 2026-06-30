export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { runHousingHarvest } from "@/lib/housing/harvest-runner";

// POST /api/homeiq/harvest — refresh the HomeIQ `properties` table from the free sources. The harvest
// LOGIC lives in lib/housing/harvest-runner (so the always-on BullMQ worker can run it too, without a
// serverless timeout). This route is a secret-gated manual/cron trigger.
// Auth: Authorization: Bearer <SCRAPE_SECRET | CRON_SECRET>. Disabled until a secret is set.

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
    return NextResponse.json(await runHousingHarvest());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
