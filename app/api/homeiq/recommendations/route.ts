export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";
import { queryProperties } from "@/lib/housing/store";
import { scoreHousingLead } from "@/lib/housing/lead-score";
import type { Property } from "@/lib/housing/types";
import {
  extractInterestProfile,
  scoreInterest,
} from "@/lib/intelligence/interest-patterns";

// GET /api/homeiq/recommendations — the HOMES half of implicit learning. Learns each investor's taste from
// the properties they SAVE (distress type / source, price band, property type) and surfaces active leads
// that match it. Mirrors /api/recommendations for cars, reusing the same interest engine — so the
// ecosystem learns from users across BOTH verticals. $0, explainable, no AI. Renders nothing until a few
// saves exist (empty-safe).

const SOURCE_LABEL: Record<string, string> = {
  absentee_owner: "absentee-owner",
  tax_delinquent: "tax-delinquent",
  code_violation: "code-violation",
  vacant_building: "vacant",
  foreclosure: "foreclosure",
  land_bank: "land-bank",
  hud_reo: "HUD REO",
};
const label = (s?: string | null) =>
  (s && SOURCE_LABEL[s]) || (s || "").replace(/_/g, " ");

export async function GET() {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id) return NextResponse.json({ deals: [], reason: "sign in" });

  const supabase = createServerComponentClient();

  // Learn from saved properties — the snapshot holds the property as it was when saved.
  const { data: saved } = await supabase
    .from("saved_properties")
    .select("snapshot")
    .eq("user_id", user.id)
    .limit(300);

  // Map homes attributes onto the shared interest engine: source(=distress type)→"make",
  // property_type→"model", plus price + source affinity. Saves are the strongest implicit signal.
  const signals = (saved || [])
    .map((r: { snapshot: Record<string, unknown> | null }) => {
      const s = r.snapshot || {};
      return {
        make: (s.source as string) || null,
        model: (s.property_type as string) || null,
        price: Number(s.price) || null,
        source: (s.source as string) || null,
        weight: 3,
      };
    })
    .filter((x) => x.source || x.price);

  const profile = extractInterestProfile(signals);
  if (
    !profile.patterns.length &&
    !profile.sources.length &&
    !profile.priceHigh
  ) {
    return NextResponse.json({
      deals: [],
      reason: "save a few properties to start learning your taste",
    });
  }

  // Candidate pool: the current top active leads, scored against the taste profile.
  const rows = (await queryProperties({ limit: 1500 })) as Property[];
  const favSources = new Set(profile.sources.slice(0, 4));

  const scored: Array<{
    id: string;
    title: string;
    address?: string;
    city?: string;
    state?: string;
    price?: number;
    image?: string;
    source?: string;
    score: number;
    tier: string;
    reason: string;
    affinity: number;
  }> = [];

  for (const r of rows) {
    const iv = scoreInterest(
      {
        make: r.source,
        model: r.property_type,
        price: r.price,
        source: r.source,
      },
      profile,
    );
    if (iv.affinity < 0.35) continue;
    const ls = scoreHousingLead(r);
    // Homes-appropriate reason (the shared engine's make/model wording doesn't fit distress leads).
    const inBand =
      profile.priceHigh > 0 &&
      typeof r.price === "number" &&
      r.price >= profile.priceLow &&
      r.price <= profile.priceHigh;
    const reason = favSources.has(r.source || "")
      ? `More ${label(r.source)} leads like you save`
      : inBand
        ? "In your usual price range"
        : "Matches what you save";
    scored.push({
      id: r.source_listing_id || r.title,
      title: r.title,
      address: r.address,
      city: r.city,
      state: r.state,
      price: r.price,
      image: r.images?.[0],
      source: r.source,
      score: ls.score,
      tier: ls.tier,
      reason,
      affinity: iv.affinity,
    });
  }

  scored.sort((a, b) => b.affinity - a.affinity || b.score - a.score);
  return NextResponse.json({ deals: scored.slice(0, 24) });
}
