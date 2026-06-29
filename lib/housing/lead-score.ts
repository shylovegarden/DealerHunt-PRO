// lib/housing/lead-score.ts
//
// HomeIQ's lead intelligence — the housing analogue of the car deal-analyzer's GO/PASS. It reads the
// signals that tell a flipper "this seller will deal": distress language, deep discount, an auction
// closing soon, thin competition, the gov-disposal channel. Pure + weighted, so every lead gets a 0–100
// score AND the reasons WHY — never a black box. Tuned for what GovDeals real estate actually carries
// today (title text + price + auction window + bid count); new signals (price-cut velocity, DOM,
// pre-foreclosure, vacancy) slot in as we add sources that expose them.

import type { Property } from "./types";
import { analyzeHousingDeal } from "./deal-analyzer";

export type LeadTier = "hot" | "warm" | "standard";

export interface LeadScore {
  score: number; // 0–100
  tier: LeadTier;
  signals: string[]; // human-readable reasons, strongest first
}

// Words sellers/agents use that scream "motivated / discounted / needs work" = opportunity.
const DISTRESS_RE =
  /\b(deeply discounted|discount(ed)?|distress(ed)?|fixer|rehab|handyman|as-?is|tlc|investor|motivated|foreclosure|reo|bank ?owned|must sell|short sale|estate|probate|vacant|tear ?down|cash only|below market|opportunity|potential|affordable|value)\b/gi;

function hoursUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) return null;
  return (t - Date.now()) / 3_600_000;
}

// Deep-discount thresholds are property-type aware (a $25k house is a steal; $25k land is normal).
function discountPoints(p: Property): { pts: number; why?: string } {
  const price = p.price ?? 0;
  if (price <= 0) return { pts: 0 };
  if (p.property_type === "land") {
    if (price < 5000) return { pts: 18, why: "Dirt-cheap lot (<$5k)" };
    if (price < 15000) return { pts: 10, why: "Cheap lot (<$15k)" };
    return { pts: 2 };
  }
  // Houses (single/multi/condo/townhouse).
  if (price < 25000)
    return { pts: 25, why: `Deep value — only $${price.toLocaleString()}` };
  if (price < 60000)
    return { pts: 16, why: `Below-market price ($${price.toLocaleString()})` };
  if (price < 120000) return { pts: 8, why: "Affordable entry price" };
  return { pts: 2 };
}

/**
 * Score one Property as a lead. Deterministic + transparent: the returned signals are exactly what drove
 * the number. ≥70 = hot, ≥45 = warm, else standard.
 */
export function scoreHousingLead(p: Property): LeadScore {
  let score = 0;
  const signals: { pts: number; text: string }[] = [];
  const add = (pts: number, text: string) => {
    score += pts;
    if (pts > 0) signals.push({ pts, text });
  };

  // 1) Distress / motivation language (stacks, capped) — the strongest tell.
  const title = `${p.title || ""} ${p.description || ""}`;
  const hits = Array.from(
    new Set((title.match(DISTRESS_RE) || []).map((s) => s.toLowerCase())),
  );
  if (hits.length) {
    const pts = Math.min(30, hits.length * 11);
    add(pts, `Motivated-seller language: ${hits.slice(0, 3).join(", ")}`);
  }

  // 2) Deep discount (price vs type).
  const d = discountPoints(p);
  if (d.pts) add(d.pts, d.why || "Discounted");

  // 3) Auction closing soon = time-sensitive, less competition near the end.
  const hrs = hoursUntil(p.auction_end);
  if (hrs != null && hrs > 0) {
    if (hrs <= 48) add(15, "Auction ends within 48h — act now");
    else if (hrs <= 24 * 7) add(8, "Auction ends this week");
  }

  // 4) Thin competition.
  if (typeof p.bid_count === "number") {
    if (p.bid_count === 0) add(12, "No bids yet — open lane");
    else if (p.bid_count <= 2) add(6, "Few bids — low competition");
  }

  // 5) Gov / foreclosure disposal channel = inherently a must-sell seller.
  if (p.seller_type === "gov" || p.seller_type === "bank") {
    add(10, "Gov / bank disposal — must-sell seller");
  }

  // 6) Property-type fit for the typical flipper (a house beats raw land for most).
  if (p.property_type === "single_family")
    add(6, "Single-family — broadest buyer pool");
  else if (p.property_type === "multi_family")
    add(5, "Multi-family — rental upside");

  // 7) EQUITY — the math signal. When sqft is known the deal-analyzer can run the 70% rule; an ask well
  // below the Max Allowable Offer is a real flip even with no distress words (HUD/Redfin sqft-rich homes
  // that would otherwise score 0). This is what surfaces the genuinely-underpriced listings.
  const deal = analyzeHousingDeal(p);
  if (deal.mao != null && deal.mao > 0 && p.price != null && p.price > 0) {
    const room = (deal.mao - p.price) / deal.mao; // fraction the ask sits below the max offer
    if (room >= 0.3)
      add(
        24,
        `Priced ~${Math.round(room * 100)}% below max offer — strong equity`,
      );
    else if (room >= 0.12) add(13, "Below max offer — real equity room");
    else if (room >= 0) add(5, "At/near the max offer");
  }

  // 8) MONEY GATE — the verified 70%-rule verdict (when ARV is computable) overrides distress "vibes".
  // A lead the math says is OVERPRICED must never surface as a top "hot" lead, however motivated the
  // wording — that's where a user loses money. Conversely a verified flip earns a real bump.
  let overpriced = false;
  if (deal.verdict === "strong")
    add(12, "Verified flip — strong equity (70% rule)");
  else if (deal.verdict === "fair") add(6, "Verified flip — fair equity");
  else if (deal.verdict === "pass") {
    overpriced = true;
    score -= 15; // signals can't manufacture a hot lead out of an overpriced house
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let tier: LeadTier = score >= 70 ? "hot" : score >= 45 ? "warm" : "standard";
  // Hard ceiling: a verified-overpriced lead is capped below "hot" no matter how high the vibe score.
  if (overpriced && tier === "hot") tier = "warm";

  return {
    score,
    tier,
    signals: signals.sort((a, b) => b.pts - a.pts).map((s) => s.text),
  };
}

/** Attach scores and return leads sorted hottest-first. */
export function scoreAndRank(
  properties: Property[],
): (Property & { lead: LeadScore })[] {
  return properties
    .map((p) => ({ ...p, lead: scoreHousingLead(p) }))
    .sort((a, b) => b.lead.score - a.lead.score);
}
