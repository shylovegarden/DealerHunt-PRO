export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { haversineMiles, boundingBox } from "@/lib/geo/distance";
import { geocodeZip } from "@/lib/geo/geocode";

// GET /api/homeiq/near?zip=77002&radius=150 — the nearest scored properties to a searched ZIP. $0 pure math:
// geocode the ZIP (cache-first) → bounding-box pre-filter → haversine sort → nearest-first. Always surfaces
// LOCAL inventory instead of an empty exact-ZIP/city match — the homes twin of /api/deals/near.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const zip = sp.get("zip");
  if (!zip) return NextResponse.json({ properties: [], needsZip: true });

  const radius = Number(sp.get("radius")) || 150;
  const supabase = createServerComponentClient();

  const center = await geocodeZip(supabase, { zip });
  if (!center)
    return NextResponse.json({ properties: [], error: "could not locate ZIP" });

  const bb = boundingBox(center.lat, center.lng, radius);
  const { data: rows } = await supabase
    .from("properties")
    .select(
      "source_listing_id, title, source_url, price, property_type, address, city, state, zip, images, beds, baths, sqft, lat, lng, lead_score, signals",
    )
    .eq("active", true)
    .not("lat", "is", null)
    .gte("lat", bb.minLat)
    .lte("lat", bb.maxLat)
    .gte("lng", bb.minLng)
    .lte("lng", bb.maxLng)
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(600);

  const withDist: { r: any; miles: number }[] = [];
  for (const r of rows || []) {
    const miles = haversineMiles(
      center.lat,
      center.lng,
      Number(r.lat),
      Number(r.lng),
    );
    if (miles == null || miles > radius) continue;
    withDist.push({ r, miles });
  }
  withDist.sort((a, b) => a.miles - b.miles);

  const properties = withDist.slice(0, 30).map(({ r, miles }) => ({
    id: r.source_listing_id || r.title,
    title: r.title,
    url: r.source_url,
    price: r.price,
    propertyType: r.property_type,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    image: Array.isArray(r.images) ? r.images[0] : undefined,
    beds: r.beds,
    baths: r.baths,
    sqft: r.sqft,
    lat: r.lat,
    lng: r.lng,
    score: r.lead_score,
    distanceMiles: Math.round(miles),
  }));

  return NextResponse.json({ properties, center });
}
