export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { cached } from "@/lib/cache";

// GET /api/state-counts?vertical=cars|homes — live inventory count per state, so the "My States" picker can
// show "Missouri · 2,450" (Netflix-style "what's available"). Cached 5 min; the numbers barely move.

async function countByState(
  table: string,
  col: string,
): Promise<Record<string, number>> {
  const sb = createServerComponentClient();
  // One grouped aggregate via an RPC-free approach: pull the state column for active rows is too heavy, so
  // use a head/count per… no — use a single grouped query via PostgREST is unsupported; use the SQL RPC.
  const { data, error } = await sb.rpc("count_by_state", {
    p_table: table,
    p_col: col,
  });
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, number> = {};
  for (const r of data as { state: string; n: number }[]) {
    if (r.state) out[String(r.state).toUpperCase()] = Number(r.n);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const vertical =
    new URL(req.url).searchParams.get("vertical") === "homes"
      ? "homes"
      : "cars";
  const counts = await cached(`state-counts:${vertical}`, 300_000, () =>
    vertical === "homes"
      ? countByState("properties", "state")
      : countByState("deals", "location_state"),
  );
  return NextResponse.json({ vertical, counts });
}
