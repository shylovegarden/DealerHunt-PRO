// app/api/homeiq/alerts/route.ts — the HomeIQ alert INBOX. The harvest matcher (match-searches.ts) writes
// each new hot/warm property that matches a user's saved search into `housing_feed_inbox`; this reads that
// back (joined to the live property) so the user actually SEES their matches in-app — not only via email.
// Auth via cookies; scoped to the user.

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerComponentClient();
  const { data: inbox, error } = await sb
    .from("housing_feed_inbox")
    .select("property_listing_id, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!inbox?.length) return NextResponse.json({ matches: [] });

  // Join to the live property for display (drop any that have since been pruned).
  const ids = Array.from(new Set(inbox.map((r) => r.property_listing_id)));
  const { data: props } = await sb
    .from("properties")
    .select(
      "source_listing_id, title, price, city, state, zip, property_type, images, lead_score, lead_tier",
    )
    .in("source_listing_id", ids);
  const byId = new Map(
    (props || []).map((p) => [p.source_listing_id as string, p]),
  );

  const matches = inbox
    .map((r) => {
      const p = byId.get(r.property_listing_id);
      if (!p) return null;
      return {
        id: r.property_listing_id,
        status: r.status,
        matchedAt: r.created_at,
        title: p.title,
        price: p.price,
        city: p.city,
        state: p.state,
        zip: p.zip,
        image: (p.images as string[] | null)?.[0],
        score: p.lead_score,
        tier: p.lead_tier,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ matches });
}
