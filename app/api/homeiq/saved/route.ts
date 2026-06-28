// app/api/homeiq/saved/route.ts — HomeIQ saved-leads pipeline (mirrors /api/saved-cars). Auth via the
// logged-in user's cookies (getServerUser); DB ops via the service-role client scoped explicitly by
// user_id. GET lists the user's pipeline; POST saves a property with a denormalized snapshot.

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";
import { getProperty } from "@/lib/housing/store";
import { analyzeHousingDeal } from "@/lib/housing/deal-analyzer";
import type { Property } from "@/lib/housing/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerComponentClient();
  const status = new URL(req.url).searchParams.get("status");
  let q = sb.from("saved_properties").select("*").eq("user_id", user.id);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("saved_at", { ascending: false });
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

  const { listingId } = await req.json().catch(() => ({}));
  if (!listingId)
    return NextResponse.json({ error: "listingId required" }, { status: 400 });

  const p = await getProperty(String(listingId));
  if (!p)
    return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const a = analyzeHousingDeal(p as Property);
  const snapshot = {
    title: p.title,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    price: p.price,
    property_type: p.property_type,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    image: p.images?.[0],
    source: p.source,
    source_url: p.source_url,
    lead_score: p.lead_score,
    lead_tier: p.lead_tier,
    mao: a.mao,
    arv: a.arv,
    verdict: a.verdict,
    savedFrom: new Date().toISOString(),
  };

  const sb = createServerComponentClient();
  const { data: existing } = await sb
    .from("saved_properties")
    .select("id")
    .eq("user_id", user.id)
    .eq("property_listing_id", listingId)
    .maybeSingle();
  if (existing)
    return NextResponse.json({ id: existing.id, alreadySaved: true });

  const { data, error } = await sb
    .from("saved_properties")
    .insert({
      user_id: user.id,
      property_listing_id: listingId,
      snapshot,
      status: "new",
    })
    .select("id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}
