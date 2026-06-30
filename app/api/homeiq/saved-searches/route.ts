// app/api/homeiq/saved-searches/route.ts — HomeIQ saved searches / instant alerts CRUD. Auth via the
// logged-in user's cookies (getServerUser); DB via the service-role client scoped explicitly by user_id.
// GET lists; POST creates; DELETE removes one. The harvest matcher (match-searches.ts) reads these.

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";

const FIELDS = [
  "name",
  "state",
  "city",
  "zip",
  "property_type",
  "source",
  "min_price",
  "max_price",
  "min_beds",
  "min_lead_score",
  "tier",
  "notify_email",
  "notify_sms",
] as const;

export async function GET() {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createServerComponentClient();
  const { data, error } = await sb
    .from("housing_saved_searches")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const row: Record<string, unknown> = { user_id: user.id, is_active: true };
  for (const f of FIELDS)
    if (body[f] != null && body[f] !== "") row[f] = body[f];
  if (!row.name) row.name = "My deal alert";

  const sb = createServerComponentClient();
  const { data, error } = await sb
    .from("housing_saved_searches")
    .insert(row)
    .select("id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}

export async function DELETE(req: NextRequest) {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = createServerComponentClient();
  const { error } = await sb
    .from("housing_saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
