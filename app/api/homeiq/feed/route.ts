export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { resolvePropertyImage } from "@/lib/housing/property-image";

// GET /api/homeiq/feed?offset=0&limit=12 — the homes twin of /api/feed: a flat, aerial/photo-first stream of
// the hottest distressed leads for the full-screen swipe feed. Ranked by lead_score, paginated. $0.

function distressLabel(s: any): string | null {
  const d = s || {};
  if (d.foreclosure || d.sheriff_sale) return "⚖️ Foreclosure";
  if (d.tax_delinquent || d.total_due) return "Tax-delinquent";
  if (d.code_violation || d.violation_count) return "Code violations";
  if (d.vacant) return "Vacant";
  if (d.absentee_owner || d.out_of_state) return "Absentee owner";
  return null;
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 12, 1), 30);
  // Multi-state curation: `?states=MO,IL` (chosen states) or single `?state`. Empty = all.
  const scopeStates = (sp.get("states")?.split(",") ?? [sp.get("state")])
    .map((s) => s?.trim().toUpperCase())
    .filter((s): s is string => !!s);

  const supabase = createServerComponentClient();
  let q = supabase
    .from("properties")
    .select(
      "source_listing_id, title, source_url, address, city, state, zip, price, images, lat, lng, lead_score, lead_tier, beds, baths, sqft, signals",
    )
    .eq("active", true)
    .not("lat", "is", null)
    .order("lead_score", { ascending: false, nullsFirst: false })
    .order("scraped_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (scopeStates.length === 1) q = q.eq("state", scopeStates[0]);
  else if (scopeStates.length > 1) q = q.in("state", scopeStates);

  const { data, error } = await q;
  if (error)
    return NextResponse.json({
      items: [],
      nextOffset: offset,
      error: error.message,
    });

  const items = (data || []).map((p: any) => {
    const img = resolvePropertyImage({
      image: Array.isArray(p.images) ? p.images[0] : null,
      lat: p.lat,
      lng: p.lng,
    });
    const owner = (p.signals as any)?.owner;
    return {
      id: p.source_listing_id,
      title: p.title,
      url: p.source_url,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      price: p.price != null ? Number(p.price) : null,
      image: img?.url ?? null,
      imageKind: img?.kind ?? null,
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      score: p.lead_score != null ? Number(p.lead_score) : null,
      tier: p.lead_tier,
      distress: distressLabel(p.signals),
      owner: typeof owner === "string" ? owner : null,
    };
  });

  return NextResponse.json({ items, nextOffset: offset + limit });
}
