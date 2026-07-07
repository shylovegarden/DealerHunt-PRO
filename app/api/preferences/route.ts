// app/api/preferences/route.ts — cross-app user view preferences (HomeIQ + DealerHunt). GET returns the
// user's prefs object; PUT MERGES a partial update in (so each app saves its own slice without clobbering
// the other's). Auth via cookies; RLS scopes every row to its owner.

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";
import { activeStates, addActiveState } from "@/lib/housing/active-states";

export const dynamic = "force-dynamic";

export async function GET() {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerComponentClient();
  const { data, error } = await sb
    .from("user_preferences")
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prefs: data?.prefs || {} });
}

export async function PUT(req: NextRequest) {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let patch: Record<string, unknown> = {};
  try {
    patch = (await req.json()) || {};
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof patch !== "object" || Array.isArray(patch))
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = createServerComponentClient();
  // Merge server-side so one app's save never drops another's keys.
  const { data: existing } = await sb
    .from("user_preferences")
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();
  const merged = { ...((existing?.prefs as object) || {}), ...patch };

  const { error } = await sb.from("user_preferences").upsert(
    {
      user_id: user.id,
      prefs: merged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // DEMAND HOOK — if the user just picked a housing state (single default or hunt-list) that isn't in the
  // active harvest scope yet, add it so the next harvest starts covering it. Server power follows demand.
  try {
    const demanded = new Set<string>();
    if (typeof patch.homeiqState === "string" && patch.homeiqState)
      demanded.add(patch.homeiqState.toUpperCase());
    for (const s of (patch.homeiqStates as string[] | undefined) ?? [])
      if (typeof s === "string" && s) demanded.add(s.toUpperCase());
    if (demanded.size) {
      const already = new Set(await activeStates());
      const toAdd = Array.from(demanded).filter((s) => !already.has(s));
      await Promise.all(toAdd.map((s) => addActiveState(s, user.id)));
    }
  } catch {
    /* non-fatal — the pref still saved */
  }

  return NextResponse.json({ prefs: merged });
}
