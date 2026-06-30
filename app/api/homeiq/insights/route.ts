// app/api/homeiq/insights/route.ts — the learning-loop insights for the signed-in user's pipeline.
// Reads their saved_properties, turns each into a training row (features + win/loss/profit label), and
// returns the calibration summary: win rate by predicted tier ("is our hot actually hot?"), realized
// profit, and progress toward the point where the model starts adjusting the score. Honest by design —
// it reports exactly what's been resolved, nothing inferred.

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";
import {
  extractOutcomeRow,
  summarizeOutcomes,
  calibrationFromOutcomes,
  type OutcomeRow,
} from "@/lib/housing/outcomes";

export const dynamic = "force-dynamic";

export async function GET() {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerComponentClient();
  const { data, error } = await sb
    .from("saved_properties")
    .select("status, snapshot")
    .eq("user_id", user.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || [])
    .map((r) => extractOutcomeRow(r as any))
    .filter((r): r is OutcomeRow => r != null);
  const summary = summarizeOutcomes(rows);
  const calibration = calibrationFromOutcomes(summary);

  return NextResponse.json({ summary, calibration });
}
