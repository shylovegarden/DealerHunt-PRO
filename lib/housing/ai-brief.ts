// lib/housing/ai-brief.ts
//
// The AI deal brief — turns HomeIQ's hard numbers into a plain-English investor verdict. It is GROUNDED:
// every number is computed by us (flip MAO, cap rate, distress signals, comps) and handed to the model,
// which is told to reason ONLY from those facts and never invent figures. Cost-gated (no model key →
// returns null, the UI just hides the card) so it never blocks the free core. On-demand + cached so we
// only spend tokens when a user actually asks for a brief on a specific property.

import { generateText } from "ai";
import { getTextModel, hasTextModel } from "../ai/text-model";
import type { Property } from "./types";
import { analyzeHousingDeal } from "./deal-analyzer";
import { rentCashflow } from "./rent";
import { scoreHousingLead } from "./lead-score";
import { housingPriceTerms } from "./price-semantics";

/** Assemble ONLY real, computed facts about a property for the model to reason over. */
export function dealFacts(p: Property) {
  const score = scoreHousingLead(p);
  const deal = analyzeHousingDeal(p);
  const basis =
    p.price && deal.repairEstimate != null
      ? p.price + deal.repairEstimate
      : undefined;
  const cf = rentCashflow(p.price, p.zip, { basis });
  const sig = (p.signals as any) || {};
  return {
    property: {
      address: [p.address, p.city, p.state, p.zip].filter(Boolean).join(", "),
      type: p.property_type,
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      year_built: p.year_built,
      price: p.price,
      priceMeans: housingPriceTerms(p.source, !!p.auction_end).priceLabel,
      source: p.source,
      sellerType: p.seller_type,
      listingRemarks: p.description?.slice(0, 600),
      daysOnMarket: sig.days_on_market,
      status: sig.status,
    },
    leadScore: { score: score.score, tier: score.tier, reasons: score.signals },
    flip: {
      arv: deal.arv,
      arvConfidence: deal.arvConfidence,
      arvBasis: deal.arvBasis,
      repairEstimate: deal.repairEstimate,
      rehabLevel: deal.rehabLevel,
      maxAllowableOffer: deal.mao,
      verdict: deal.verdict,
      grossEquitySpread: deal.equitySpread,
      notes: deal.notes,
    },
    hold: cf
      ? {
          marketRentPerMonth: cf.monthlyRent,
          capRatePct: cf.capRatePct,
          monthlyCashflow: cf.monthlyCashflow,
          rating: cf.rating,
          basisUsed: basis ?? p.price,
        }
      : null,
    distress: {
      taxDelinquent: sig.tax_delinquent || undefined,
      yearsOwed: sig.years_owed || undefined,
      totalDue: sig.total_due || undefined,
      foreclosure: sig.foreclosure || undefined,
      sheriffSale: sig.sheriff_sale || undefined,
      vacant: sig.vacant || undefined,
      codeViolations: sig.violation_count || undefined,
      absentee: sig.out_of_state_owner || sig.absentee || undefined,
      ownerOfRecord: sig.owner || undefined,
    },
  };
}

const SYSTEM = `You are a sharp, honest real-estate investment analyst writing a deal brief for an experienced investor.
Rules:
- Reason ONLY from the DATA provided. NEVER invent prices, rents, ARV, or comps that aren't given.
- If ARV confidence is "low" or a number is missing, say so plainly — do not fabricate certainty.
- Be concise and specific. No fluff, no disclaimers about being an AI.
- Cover both exit strategies when data exists: FLIP (70% rule / MAO) and HOLD (cap rate / cashflow).
Format in short markdown with these sections:
**Verdict** — one decisive line (Strong buy / Worth a look / Pass) and why.
**The numbers** — the key figures that matter, flip and hold.
**Risks & unknowns** — what could break this deal or what data is missing.
**Move** — a concrete next step + a suggested opening offer with brief reasoning.`;

/** Generate a grounded, plain-English deal brief. Returns null when no model is configured (free-first). */
export async function generateDealBrief(p: Property): Promise<string | null> {
  if (!hasTextModel()) return null;
  const facts = dealFacts(p);
  try {
    const { text } = await generateText({
      model: getTextModel(),
      system: SYSTEM,
      prompt: `DATA (all figures are real, computed by our engine — use only these):\n${JSON.stringify(facts, null, 2)}`,
      temperature: 0.3,
    });
    return text.trim() || null;
  } catch {
    return null;
  }
}
