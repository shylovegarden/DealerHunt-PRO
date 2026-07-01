// app/api/homeiq/insights/route.ts — the learning-loop status for the calibration card.
//
// Returns the GLOBAL model calibration — the exact summary the scorer uses (loadCalibration reads every
// closed/dead deal, service-role, and injects the per-tier factors into scoring). The card must show what
// the model actually does, not a per-user slice that wouldn't match the (global) adjustment. Auth-gated so
// only signed-in users see it; the numbers are aggregate outcomes, no PII.

import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/server-supabase";
import { loadCalibration } from "@/lib/housing/calibration";
import { calibrationFromOutcomes } from "@/lib/housing/outcomes";

export const dynamic = "force-dynamic";

export async function GET() {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await loadCalibration().catch(() => null);
  if (!summary) return NextResponse.json({ summary: null, calibration: null });
  return NextResponse.json({
    summary,
    calibration: calibrationFromOutcomes(summary),
  });
}
