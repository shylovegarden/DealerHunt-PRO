// lib/housing/match-searches.ts
//
// Instant deal alerts for HomeIQ — the housing twin of the cars matchUserSearches. After a harvest writes
// properties, this matches the fresh HOT/WARM ones against every active saved search, records each in a
// per-user inbox (UNIQUE(user_id, property_listing_id) = the "notify only on a genuinely NEW property"
// dedup key), and emails the user the new matches. Best-effort + isolated: any failure (missing table, no
// email key) is swallowed so it never breaks the harvest. Free core stays intact when nothing's configured.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "./types";
import { scoreHousingLead } from "./lead-score";
import { analyzeHousingDeal } from "./deal-analyzer";
import { rentCashflow } from "./rent";
import { sendPropertyMatchEmail } from "@/lib/notifications/email";

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://dealerhunt.app"
  ).replace(/\/$/, "");
}

interface Scored {
  p: Property;
  id: string;
  score: number;
  tier: string;
  mao: number | null;
  verdict: string | null;
  capRate: number | null;
}

const lc = (v?: string | null) => (v || "").trim().toLowerCase();

/** Does a scored property satisfy one saved search's criteria? */
function matches(s: any, x: Scored): boolean {
  const p = x.p;
  if (s.state && lc(s.state) !== lc(p.state)) return false;
  if (s.city && lc(s.city) !== lc(p.city)) return false;
  if (s.zip && String(s.zip).slice(0, 5) !== String(p.zip || "").slice(0, 5))
    return false;
  if (s.property_type && lc(s.property_type) !== lc(p.property_type))
    return false;
  if (s.source && lc(s.source) !== lc(p.source)) return false;
  if (s.min_price != null && (p.price ?? 0) < Number(s.min_price)) return false;
  if (s.max_price != null && (p.price ?? Infinity) > Number(s.max_price))
    return false;
  if (s.min_beds != null && (p.beds ?? 0) < Number(s.min_beds)) return false;
  if (s.min_lead_score != null && x.score < Number(s.min_lead_score))
    return false;
  if (s.tier && lc(s.tier) === "hot" && x.tier !== "hot") return false;
  if (s.tier && lc(s.tier) === "warm" && x.tier === "standard") return false;
  return true;
}

/**
 * Match freshly-harvested properties against active saved searches and notify users of NEW matches.
 * Only HOT/WARM properties are alert-worthy (standard leads never trigger a push), then each search's own
 * criteria refine further. Safe to call at the end of every harvest.
 */
export async function matchHousingSearches(
  properties: Property[],
): Promise<void> {
  try {
    const sb = service();
    const { data: searches } = await sb
      .from("housing_saved_searches")
      .select("*")
      .eq("is_active", true);
    if (!searches || !searches.length) return;

    // Score once; only HOT/WARM are alert-worthy.
    const scored: Scored[] = [];
    for (const p of properties) {
      const id = p.source_listing_id;
      if (!id) continue;
      const ls = scoreHousingLead(p);
      if (ls.tier === "standard") continue;
      const deal = analyzeHousingDeal(p);
      const basis =
        p.price && deal.repairEstimate != null
          ? p.price + deal.repairEstimate
          : undefined;
      const cf = rentCashflow(p.price, p.zip, { basis });
      scored.push({
        p,
        id,
        score: ls.score,
        tier: ls.tier,
        mao: deal.mao ?? null,
        verdict: deal.verdict ?? null,
        capRate: cf?.capRatePct ?? null,
      });
    }
    if (!scored.length) return;

    // Build (user, property) matches, remembering the search that produced each (for its notify flags).
    type M = {
      user_id: string;
      search_id: string;
      search_name: string;
      notify_email: boolean;
      id: string;
      x: Scored;
    };
    const all: M[] = [];
    for (const x of scored)
      for (const s of searches)
        if (matches(s, x))
          all.push({
            user_id: s.user_id,
            search_id: s.id,
            search_name: s.name,
            notify_email: s.notify_email !== false,
            id: x.id,
            x,
          });
    if (!all.length) return;

    // Genuinely-new = not already in the inbox (and de-dup within this run by user+property).
    const userIds = Array.from(new Set(all.map((m) => m.user_id)));
    const ids = Array.from(new Set(all.map((m) => m.id)));
    const { data: existing } = await sb
      .from("housing_feed_inbox")
      .select("user_id, property_listing_id")
      .in("user_id", userIds)
      .in("property_listing_id", ids);
    const seen = new Set(
      (existing || []).map((r) => `${r.user_id}:${r.property_listing_id}`),
    );
    const fresh: M[] = [];
    for (const m of all) {
      const k = `${m.user_id}:${m.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      fresh.push(m);
    }
    if (!fresh.length) return;

    await sb.from("housing_feed_inbox").upsert(
      fresh.map((m) => ({
        user_id: m.user_id,
        search_id: m.search_id,
        property_listing_id: m.id,
        status: "unread",
      })),
      { onConflict: "user_id,property_listing_id", ignoreDuplicates: true },
    );
    console.log(
      `[HomeIQ:alerts] ${fresh.length} new matches across ${userIds.length} users`,
    );

    // Email each user their new matches, grouped by search (resolve email via the admin API).
    const byUser = new Map<string, M[]>();
    for (const m of fresh) {
      if (!m.notify_email) continue;
      const arr = byUser.get(m.user_id) || [];
      arr.push(m);
      byUser.set(m.user_id, arr);
    }
    for (const [userId, ms] of Array.from(byUser.entries())) {
      try {
        const { data: u } = await sb.auth.admin.getUserById(userId);
        const email = u?.user?.email;
        if (!email) continue;
        const searchName = ms[0].search_name;
        await sendPropertyMatchEmail({
          to: email,
          searchName,
          manageUrl: `${baseUrl()}/homeiq/alerts`,
          properties: ms.slice(0, 12).map((m) => ({
            title: m.x.p.title,
            price: m.x.p.price,
            city: m.x.p.city,
            state: m.x.p.state,
            score: m.x.score,
            tier: m.x.tier,
            mao: m.x.mao,
            verdict: m.x.verdict,
            capRate: m.x.capRate,
            url: `${baseUrl()}/homeiq/leads/${encodeURIComponent(m.id)}`,
          })),
        });
      } catch (e) {
        console.warn("[HomeIQ:alerts] notify failed:", (e as Error).message);
      }
    }
  } catch (e) {
    console.warn(
      "[HomeIQ:alerts] matchHousingSearches skipped:",
      (e as Error).message,
    );
  }
}
