// lib/housing/condition.ts
//
// The housing twin of lib/intelligence/condition (cars): turn the messy per-source status/title into one
// honest, glanceable condition signal a flipper reads first — "Move-in ready" vs "Needs renovation" vs
// "Vacant land". Distinct from price (what you pay) and from the listing event (price reduced / new). Pure.

export type HomeConditionTier = "good" | "caution" | "risk" | "info";

export interface HomeConditionRead {
  label: string;
  tier: HomeConditionTier;
}

const RENO_RX =
  /needs?\s*(work|renovation|rehab|tlc)|renovation|rehab|fixer|gut(\s|-|$)|tear[-\s]?down|fire damage|handyman|investor special|as[-\s]?is|distressed|shell|cash only|sold as is/i;
const READY_RX =
  /move[-\s]?in|turn[-\s]?key|renovated|rehabbed|new construction|newly built|updated|remodeled|available soon|ready to/i;
const PENDING_RX = /pending|under contract|in escrow|contingent|transfer/i;

/**
 * Normalize a housing listing's condition from its property type + short status + title. Returns null when
 * there's no usable signal. Land is its own honest state (no structure to assess).
 */
export function readHomeCondition(input: {
  property_type?: string | null;
  status?: string | null;
  title?: string | null;
}): HomeConditionRead | null {
  const type = (input.property_type || "").toLowerCase();
  if (
    type === "land" ||
    /vacant\s*(land|lot)|^lot\b|land$/.test(
      `${input.status || ""} ${input.title || ""}`.toLowerCase(),
    )
  )
    return { label: "Vacant land", tier: "caution" };

  const text = `${input.status || ""} ${input.title || ""}`;
  if (!text.trim()) return null;

  if (PENDING_RX.test(text)) return { label: "Pending", tier: "info" };
  if (RENO_RX.test(text)) return { label: "Needs renovation", tier: "risk" };
  if (READY_RX.test(text)) return { label: "Move-in ready", tier: "good" };
  return null;
}

export const HOME_CONDITION_TIER_COLOR: Record<HomeConditionTier, string> = {
  good: "var(--green)",
  caution: "var(--t4)",
  risk: "var(--red)",
  info: "var(--blue)",
};
