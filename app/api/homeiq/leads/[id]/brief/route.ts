export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { getProperty } from "@/lib/housing/store";
import { generateDealBrief } from "@/lib/housing/ai-brief";
import { hasTextModel } from "@/lib/ai/text-model";
import type { Property } from "@/lib/housing/types";

// GET /api/homeiq/leads/[id]/brief — the AI deal brief for one property. On-demand (only spends tokens
// when a user asks) + cached in-memory so repeat views are free. Returns { available:false } when no model
// key is set, so the UI hides the feature gracefully instead of erroring.

const CACHE = new Map<string, { at: number; brief: string }>();
const TTL = 6 * 60 * 60_000; // 6h — listings don't change that fast

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!hasTextModel()) return NextResponse.json({ available: false });

  const hit = CACHE.get(id);
  if (hit && Date.now() - hit.at < TTL)
    return NextResponse.json({
      available: true,
      brief: hit.brief,
      cached: true,
    });

  const row = await getProperty(id);
  if (!row)
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const brief = await generateDealBrief(row as Property);
  if (!brief)
    return NextResponse.json({ available: false, error: "brief unavailable" });

  CACHE.set(id, { at: Date.now(), brief });
  return NextResponse.json({ available: true, brief });
}
