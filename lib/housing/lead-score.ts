// lib/housing/lead-score.ts
//
// HomeIQ's lead intelligence — the housing analogue of the car deal-analyzer's GO/PASS. Models the way the
// top motivated-seller platforms (PropStream / BatchLeads / DistressIQ) actually rank leads: a weighted
// MOTIVATION score from independent signal GROUPS, a super-linear STACKING bonus when several groups fire
// at once (the documented core of their predictive power), tiered distress keywords + negative ("full
// price") keywords to kill false positives, and a verified-equity MONEY GATE so an overpriced house can
// never top the list. Pure + transparent: every lead returns the exact reasons + a 0–100 score, tier, and
// letter grade. Listing-only today; parcel/owner signals (tax-delinquent, absentee, pre-foreclosure) slot
// into the same group/stacking framework as those free county sources come online.

import type { Property } from "./types";
import { analyzeHousingDeal } from "./deal-analyzer";
import { rentCashflow } from "./rent";
import { neighborhoodScore } from "./neighborhood";
import type { TierCalibration } from "./outcomes";

export type LeadTier = "hot" | "warm" | "standard";

// LEARNED calibration (injectable, like the live-psf map). Computed from realized pipeline outcomes
// (calibrationFromOutcomes) and set once per harvest/request; null until there's enough real resolved data,
// so today this is a transparent no-op — the score only starts bending once users actually close/kill deals.
let TIER_CAL: TierCalibration | null = null;
export function setTierCalibration(c: TierCalibration | null): void {
  TIER_CAL = c;
}

export interface LeadScore {
  score: number; // 0–100
  tier: LeadTier;
  grade: string; // A+ … C- (glanceable, like the commercial "DealScore")
  signals: string[]; // human-readable reasons, strongest first
}

// Tiered distress keywords — financial/legal urgency outranks circumstantial outranks condition. We award
// the HIGHEST tier matched (+ a small breadth bonus), not a sum, so wording can't run away with the score.
const KW_FINANCIAL =
  /\b(must sell|bring (all )?offers|priced to sell|quick close|motivated|deeply discounted|distress(ed)?|foreclosure|short sale|bank ?owned|reo|auction|below market)\b/i;
const KW_CIRCUMSTANTIAL =
  /\b(estate sale|estate|probate|inherited|relocat(e|ing|ion)|divorce|out[-\s]?of[-\s]?state|vacant|moving)\b/i;
const KW_CONDITION =
  /\b(as-?is|investor special|handyman|fixer|needs? work|rehab|tear ?down|cash only|tlc|gut)\b/i;
const KW_COSMETIC = /\b(dated|needs? updating|outdated|original condition)\b/i;
// "Full-price intent" wording — a retail seller, not a deal. Penalize so a polished listing can't sneak in.
const KW_NEGATIVE =
  /\b(pride of ownership|luxurious|stunning|meticulous(ly)?|immaculate|pristine|turn[-\s]?key|move[-\s]?in ready|fully renovated|like new|gorgeous|dream home)\b/i;

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
  if (price < 25000)
    return { pts: 25, why: `Deep value — only $${price.toLocaleString()}` };
  if (price < 60000)
    return { pts: 16, why: `Below-market price ($${price.toLocaleString()})` };
  if (price < 120000) return { pts: 8, why: "Affordable entry price" };
  return { pts: 2 };
}

function gradeFor(score: number): string {
  if (score >= 85) return "A+";
  if (score >= 76) return "A";
  if (score >= 70) return "A-";
  if (score >= 62) return "B+";
  if (score >= 54) return "B";
  if (score >= 45) return "B-";
  if (score >= 32) return "C";
  return "C-";
}

/**
 * Score one Property as a lead. Deterministic + transparent: the returned signals are exactly what drove
 * the number. Motivation GROUPS (keywords, price-cut, days-on-market, below-market/equity) earn points;
 * 3+ groups firing applies a stacking bonus. A verified-overpriced verdict can never be hot.
 */
export function scoreHousingLead(p: Property): LeadScore {
  let score = 0;
  const signals: { pts: number; text: string }[] = [];
  const groups = new Set<string>(); // independent motivation evidence (for the stacking bonus)
  const add = (pts: number, text: string, group?: string) => {
    score += pts;
    if (pts > 0) {
      signals.push({ pts, text });
      if (group) groups.add(group);
    }
  };

  const text = `${p.title || ""} ${p.description || ""}`;

  // 1) Distress / motivation language — highest tier matched, + breadth bonus, − full-price penalty.
  let kwPts = 0;
  let kwWhy = "";
  if (KW_FINANCIAL.test(text)) {
    kwPts = 20;
    kwWhy = "Financial/urgency wording (must-sell / foreclosure / motivated)";
  } else if (KW_CIRCUMSTANTIAL.test(text)) {
    kwPts = 14;
    kwWhy = "Circumstantial wording (estate / probate / relocation / vacant)";
  } else if (KW_CONDITION.test(text)) {
    kwPts = 8;
    kwWhy = "Condition wording (as-is / fixer / handyman)";
  } else if (KW_COSMETIC.test(text)) {
    kwPts = 2;
    kwWhy = "Light cosmetic wording";
  }
  if (kwPts > 0) {
    // Breadth: a second distinct distress register reinforces motivation.
    const registers = [KW_FINANCIAL, KW_CIRCUMSTANTIAL, KW_CONDITION].filter(
      (re) => re.test(text),
    ).length;
    if (registers >= 2) kwPts = Math.min(30, kwPts + 6);
    add(kwPts, kwWhy, kwPts >= 8 ? "kw" : undefined);
  }
  if (KW_NEGATIVE.test(text)) {
    score -= 10; // polished, full-price listing — not a deal
    signals.push({ pts: 0.01, text: "Full-price wording (−)" });
  }

  // 2) Deep discount vs type (a below-market entry price).
  const d = discountPoints(p);
  if (d.pts)
    add(d.pts, d.why || "Discounted", d.pts >= 8 ? "price" : undefined);

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
  if (p.seller_type === "gov" || p.seller_type === "bank")
    add(10, "Gov / bank disposal — must-sell seller");

  // 6) Property-type fit for the typical flipper.
  if (p.property_type === "single_family")
    add(6, "Single-family — broadest buyer pool");
  else if (p.property_type === "multi_family")
    add(5, "Multi-family — rental upside");

  // 6b) PRICE CUT — a published reduction is one of the strongest "seller will deal" tells.
  const status = String(
    (p.signals as any)?.status || (p.signals as any)?.sale_type || "",
  ).toLowerCase();
  if (/reduc|price\s*drop|price\s*cut/.test(status))
    add(14, "Price reduced — seller is actively dropping the ask", "pricecut");

  // 6b-ii) COMING SOON / PRE-MARKET — a listing not yet fully public is an early-access lane: reach the
  // seller before the open-market bidding war. The wholesaler's edge, straight off the MLS status.
  if (/coming\s*soon|pre[-\s]*on[-\s]*market|pre[-\s]*market/.test(status))
    add(
      9,
      "Coming soon / pre-market — early access, low competition",
      "timing",
    );

  // 6b-iii) SELF-DETECTED PRICE DROP — we watched the price fall across our OWN harvests (DB trigger),
  // independent of whether the source tagged a reduction. A recent cut is a strong "seller will deal" tell;
  // repeated cuts = a softening, motivated seller. Recency-weighted; skipped when the source already tags a
  // reduction (the block above) so we never double-count the same concept.
  const priceDrops = Number(p.price_drops) || 0;
  if (priceDrops > 0 && !/reduc|price\s*drop|price\s*cut/.test(status)) {
    const daysSinceCut = p.price_changed_at
      ? (Date.now() - Date.parse(p.price_changed_at)) / 86_400_000
      : NaN;
    const fresh = Number.isFinite(daysSinceCut) && daysSinceCut <= 45;
    const cutPct =
      p.prev_price && p.price && p.prev_price > 0
        ? Math.round((1 - p.price / p.prev_price) * 100)
        : 0;
    let pts = priceDrops >= 3 ? 16 : priceDrops === 2 ? 12 : 8;
    if (!fresh) pts = Math.round(pts * 0.6); // a stale one-time cut is weaker motivation
    add(
      pts,
      `Price cut ${priceDrops}×${cutPct > 0 ? ` (−${cutPct}% latest)` : ""} — seller softening`,
      "pricecut",
    );
  }

  // 6c) DAYS ON MARKET — a stale listing is a softening seller. Prefer the REAL days-on-market the MLS feed
  // carries (signals.days_on_market); fall back to created_at (first-seen) only when it's absent.
  const realDom = Number((p.signals as any)?.days_on_market);
  const firstSeen = (p as any).created_at as string | undefined;
  const days = Number.isFinite(realDom)
    ? realDom
    : firstSeen
      ? (Date.now() - Date.parse(firstSeen)) / 86_400_000
      : NaN;
  if (Number.isFinite(days)) {
    if (days >= 180)
      add(14, `On market ${Math.round(days)}d — very stale, motivated`, "dom");
    else if (days >= 90)
      add(10, `On market ${Math.round(days)}d — stale, negotiable`, "dom");
    else if (days >= 45) add(6, "On market 45d+ — softening", "dom");
  }

  // 6d) OWNER DISTRESS (parcel/county data) — the high-value off-market signals the paid platforms sell,
  // carried in signals by the county connectors (e.g. tax-delinquent source). Tax delinquency is weighted
  // by years owed; a scheduled sheriff/tax sale is a hard deadline; absentee/out-of-state = less attached.
  const sig = (p.signals as any) || {};
  if (sig.tax_delinquent) {
    const yrs = Number(sig.years_owed) || 0;
    if (yrs >= 3)
      add(
        26,
        `Tax-delinquent ${yrs}yrs — escalating toward tax sale`,
        "owner_distress",
      );
    else add(14, "Tax-delinquent — financial pressure", "owner_distress");
  }
  if (sig.sheriff_sale)
    add(28, "Sheriff/tax sale scheduled — hard deadline", "owner_distress");
  if (sig.foreclosure)
    add(
      26,
      "Foreclosure filing — pre-foreclosure, motivated",
      "owner_distress",
    );
  if (sig.out_of_state_owner)
    add(14, "Out-of-state owner — absentee, less attached", "owner_distress");
  else if (sig.absentee) add(8, "Absentee owner", "owner_distress");
  if (sig.bankruptcy) add(10, "Owner in bankruptcy");
  if (sig.reo)
    add(
      16,
      "Bank-owned REO — motivated institutional seller",
      "owner_distress",
    );
  if (sig.land_bank)
    add(8, "Land-bank inventory — must-sell public seller", "owner_distress");
  if (sig.below_market)
    add(
      16,
      "Asking far below assessed value — built-in equity",
      "owner_distress",
    );
  if (sig.dangerous)
    add(
      16,
      "Condemned / dangerous structure — owner wants out",
      "owner_distress",
    );
  if (sig.vacant)
    add(18, "Vacant / unsafe — carrying cost, no attachment", "owner_distress");
  if (sig.code_violation) {
    const n = Number(sig.violation_count) || 1;
    add(
      n >= 5 ? 20 : 14,
      `${n} open code violation${n > 1 ? "s" : ""} — accruing fines`,
      "owner_distress",
    );
  }

  // 7) EQUITY — the math signal. An ask well below the Max Allowable Offer is a real flip even with no
  // distress words (the sqft-rich HUD/Redfin homes that would otherwise score 0).
  const deal = analyzeHousingDeal(p);
  // Equity bonus only on COMP/COUNTY-grade ARV — a coarse statewide-median ARV can't earn "strong equity"
  // (that's what put $1,000 Detroit land-bank shells on top with a fabricated ~$300k spread).
  const arvTrusted =
    deal.arvConfidence === "high" || deal.arvConfidence === "medium";
  if (
    arvTrusted &&
    deal.mao != null &&
    deal.mao > 0 &&
    p.price != null &&
    p.price > 0
  ) {
    const room = (deal.mao - p.price) / deal.mao;
    if (room >= 0.3)
      add(
        24,
        `Priced ~${Math.round(room * 100)}% below max offer — strong equity`,
        "equity",
      );
    else if (room >= 0.12)
      add(13, "Below max offer — real equity room", "equity");
    else if (room >= 0) add(5, "At/near the max offer");
  }

  // 7b) RENTAL CASHFLOW — the buy-and-hold lens. A strong cap rate (ZIP market rent vs the all-in basis,
  // 50% rule) is its own reason to buy, independent of flip equity. Basis = ask + estimated repairs when
  // known so the yield isn't flattered. A property that both flips AND cashflows stacks higher.
  const cf = rentCashflow(p.price, p.zip, {
    basis:
      p.price && deal.repairEstimate != null
        ? p.price + deal.repairEstimate
        : undefined,
  });
  if (cf) {
    if (cf.rating === "strong")
      add(
        16,
        `Strong rental cashflow — ${cf.capRatePct}% cap rate`,
        "cashflow",
      );
    else if (cf.rating === "decent")
      add(9, `Decent rental cashflow — ${cf.capRatePct}% cap rate`, "cashflow");
  }

  // 7c) NEIGHBORHOOD TRAJECTORY (Census ACS) — a ZIP with rising incomes/population appreciates (lifts the
  // real ARV over the hold); a declining one is a warning even on a cheap price. Modest weight, NOT a
  // stacking group (it's context, not a distress list). No-op until `npm run data:acs` populates the
  // snapshot — so today it never moves the score.
  const hood = neighborhoodScore(p.zip);
  if (hood?.trajectory === "rising") add(6, `Rising area — ${hood.label}`);
  else if (hood?.trajectory === "declining") {
    score -= 5;
    signals.push({ pts: 0.01, text: `Declining area (−) — ${hood.label}` });
  }

  // ── STACKING BONUS — the super-linear payoff to overlap that the commercial scorers are built on.
  if (groups.size >= 3) {
    const bonus = Math.round(score * 0.25);
    add(bonus, `Stacked ${groups.size} independent signals (×1.25)`);
  }

  // 8) MONEY GATE — the verified 70%-rule verdict overrides distress "vibes". Strong/fair earn a bump; a
  // "pass" (overpriced) is penalized AND hard-capped below hot so a user never chases a money-loser.
  let overpriced = false;
  if (deal.verdict === "strong")
    add(12, "Verified flip — strong equity (70% rule)");
  else if (deal.verdict === "fair") add(6, "Verified flip — fair equity");
  else if (deal.verdict === "pass") {
    overpriced = true;
    score -= 15;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let tier: LeadTier = score >= 70 ? "hot" : score >= 45 ? "warm" : "standard";
  if (overpriced && tier === "hot") tier = "warm";

  // LEARNED CALIBRATION — nudge by how the predicted tier ACTUALLY converts in the pipeline. No-op until
  // there's enough real resolved data (TIER_CAL stays null), so this never bends the score on a guess.
  const bonusSignals: string[] = [];
  if (TIER_CAL) {
    const f = TIER_CAL.byTier[tier];
    if (typeof f === "number" && f !== 1) {
      score = Math.max(0, Math.min(100, Math.round(score * f)));
      tier = score >= 70 ? "hot" : score >= 45 ? "warm" : "standard";
      if (overpriced && tier === "hot") tier = "warm";
      bonusSignals.push(
        `Calibrated from ${TIER_CAL.basis} closed/dead deals (${f > 1 ? "+" : ""}${Math.round(
          (f - 1) * 100,
        )}%)`,
      );
    }
  }

  return {
    score,
    tier,
    grade: gradeFor(score),
    signals: [
      ...signals
        .filter((s) => s.pts >= 1)
        .sort((a, b) => b.pts - a.pts)
        .map((s) => s.text),
      ...bonusSignals,
    ],
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
