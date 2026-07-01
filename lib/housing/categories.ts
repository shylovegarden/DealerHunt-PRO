// lib/housing/categories.ts
//
// PropStream/BatchLeads-style "Quick Lists" — friendly lead CATEGORIES derived from the data we already
// have (source + verdict + equity + the human signal strings), so a user can browse by the motivation
// that matters (Vacant, Absentee, Tax-delinquent, Pre-foreclosure, REO, Verified flips, …) instead of raw
// source keys. A lead can belong to several. Pure + tested; the leads page renders these as filter chips.

export interface LeadLike {
  source?: string;
  verdict?: string;
  equity?: number | null;
  status?: string;
  signals?: string[];
}

const sig = (l: LeadLike, re: RegExp) =>
  (l.signals || []).some((s) => re.test(s)) || re.test(l.status || "");

export interface LeadCategory {
  key: string;
  label: string;
  match: (l: LeadLike) => boolean;
}

// Order = display order (most actionable first).
export const LEAD_CATEGORIES: LeadCategory[] = [
  {
    key: "flip",
    label: "🔑 Verified flips",
    match: (l) => l.verdict === "strong" || l.verdict === "fair",
  },
  {
    key: "high_equity",
    label: "High equity",
    match: (l) => (l.equity ?? 0) >= 50000,
  },
  {
    // A published/detected price reduction — one of the strongest "seller will deal" tells.
    key: "price_cut",
    label: "💸 Price cut",
    match: (l) => sig(l, /price cut|price reduc|price drop|reduced from/i),
  },
  {
    key: "tax_delinquent",
    label: "Tax-delinquent",
    match: (l) => l.source === "tax_delinquent" || sig(l, /tax-?delinquent/i),
  },
  {
    key: "preforeclosure",
    label: "Pre-foreclosure",
    match: (l) =>
      l.source === "foreclosure" || sig(l, /sheriff|foreclosure|tax sale/i),
  },
  {
    key: "vacant",
    label: "Vacant",
    match: (l) =>
      l.source === "dangerous_building" || sig(l, /vacant|condemn|dangerous/i),
  },
  {
    key: "absentee",
    label: "Absentee owner",
    match: (l) =>
      l.source === "absentee_owner" || sig(l, /absentee|out-of-state/i),
  },
  {
    key: "out_of_state",
    label: "Out-of-state owner",
    match: (l) => sig(l, /out-of-state/i),
  },
  {
    // Zombie = a foreclosure filing on a vacant property — abandoned mid-foreclosure, the softest sellers.
    key: "zombie",
    label: "Zombie (foreclosure + vacant)",
    match: (l) =>
      (l.source === "foreclosure" || sig(l, /foreclosure|sheriff/i)) &&
      sig(l, /vacant|condemn/i),
  },
  {
    key: "code_violation",
    label: "Code violations",
    match: (l) => l.source === "code_violation" || sig(l, /code violation/i),
  },
  {
    key: "reo",
    label: "Bank-owned (REO)",
    match: (l) => l.source === "hud_reo" || sig(l, /\breo\b|bank-owned/i),
  },
  {
    key: "land_bank",
    label: "Land bank",
    match: (l) => l.source === "land_bank",
  },
];

/** The category keys a lead belongs to. */
export function leadCategories(l: LeadLike): string[] {
  return LEAD_CATEGORIES.filter((c) => c.match(l)).map((c) => c.key);
}
