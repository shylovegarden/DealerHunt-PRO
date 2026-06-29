// lib/housing/deal-analyzer.ts
//
// HomeIQ's "should I buy, and at what price" brain — the housing twin of the car deal-analyzer's max-bid.
// House-flippers run the 70% rule: Max Allowable Offer = ARV × 0.70 − repairs. We compute that EXACTLY
// and transparently. The two inputs:
//   • repairs — estimated from sqft × an industry $/sqft by rehab level (real rule-of-thumb figures).
//   • ARV (After-Repair Value) — sqft × a regional $/sqft reference when sqft is known (flagged
//     low-confidence until we have a housing comps index / portal data with real comps). No sqft ⇒ ARV
//     is honestly "unknown" rather than guessed — the math is only as good as its inputs, and we say so.
//
// No paid services: the regional $/sqft table is approximate PUBLIC reference data (like STATE_COORDS),
// used only as a coarse basis and clearly marked. Becomes precise the moment portal sources (sqft + real
// comps) flow in. Pure + tested.

import type { Property } from "./types";
import { marketPsf } from "./arv-psf";

export type RehabLevel = "light" | "medium" | "heavy" | "gut";

// Industry rule-of-thumb rehab cost per sqft (cosmetic → full gut). Real reference figures flippers use.
const REPAIR_PSF: Record<RehabLevel, number> = {
  light: 18, // paint, carpet, fixtures
  medium: 38, // kitchen/bath refresh, some systems
  heavy: 60, // major systems + layout
  gut: 90, // down to studs
};

// Approximate regional median $/sqft (public reference, ~2024-25). FALLBACK ONLY — used when a state is
// absent from the Redfin sold-$/sqft snapshot ([[arv-psf]] / state-ppsf.json). Coarse on purpose; ARV built
// on it is flagged low-confidence. A national fallback covers unlisted states.
const STATE_PSF: Record<string, number> = {
  CA: 430,
  NY: 320,
  MA: 380,
  WA: 340,
  CO: 290,
  FL: 270,
  TX: 200,
  IL: 180,
  GA: 200,
  NC: 210,
  AZ: 280,
  NV: 270,
  OR: 320,
  NJ: 300,
  VA: 230,
  PA: 170,
  OH: 150,
  MI: 160,
  IN: 150,
  MO: 160,
  TN: 210,
  SC: 200,
  AL: 150,
  KY: 150,
  OK: 150,
  AR: 140,
  MS: 130,
  WV: 130,
  IA: 160,
  KS: 150,
  NE: 165,
  LA: 150,
  WI: 180,
  MN: 200,
  UT: 290,
  ID: 280,
  MT: 290,
  ME: 270,
  NH: 300,
  CT: 270,
  MD: 260,
  RI: 300,
  DE: 220,
  ND: 170,
  SD: 175,
  WY: 230,
  NM: 210,
  HI: 750,
  AK: 240,
  DC: 600,
  VT: 280,
};
const NATIONAL_PSF = 200;

const GUT_RE =
  /gut|tear ?down|fire damage|shell|down to studs|full rehab|major rehab|foundation/i;
const HEAVY_RE =
  /rehab|fixer|handyman|distress|investor special|needs work|tlc|as-?is|major/i;
const LIGHT_RE = /cosmetic|updated|move-?in|turnkey|renovated|like new/i;

export interface HousingAnalysis {
  askPrice: number;
  rehabLevel: RehabLevel;
  repairEstimate: number | null;
  arv: number | null;
  arvBasis: "regional_psf" | "market_psf" | "comps" | "unknown";
  arvConfidence: "high" | "medium" | "low" | "none";
  mao: number | null; // Max Allowable Offer = ARV*0.70 - repairs
  equitySpread: number | null; // ARV - ask - repairs (gross potential)
  verdict: "strong" | "fair" | "tight" | "pass" | "unknown";
  notes: string[];
}

/** Infer the rehab level from the listing language (distressed gov stock skews heavy). */
export function inferRehabLevel(p: Property): RehabLevel {
  const t = `${p.title || ""} ${p.description || ""}`;
  if (GUT_RE.test(t)) return "gut";
  if (LIGHT_RE.test(t)) return "light";
  if (HEAVY_RE.test(t)) return "heavy";
  return "medium"; // unknown gov fixer — assume meaningful work
}

/**
 * Analyze a property as a flip: estimate repairs + ARV, then the 70%-rule Max Allowable Offer. ARV is
 * only computed when sqft is known (else honestly "unknown"); callers can pass an explicit ARV to override.
 */
export function analyzeHousingDeal(
  p: Property,
  opts: { arv?: number; psf?: number; rehabLevel?: RehabLevel } = {},
): HousingAnalysis {
  const askPrice = Math.round(p.price ?? 0);
  const rehabLevel = opts.rehabLevel || inferRehabLevel(p);
  const notes: string[] = [];

  // Repairs: sqft × $/sqft by level. Land has no structure to repair.
  let repairEstimate: number | null = null;
  if (p.property_type === "land") {
    repairEstimate = 0;
    notes.push("Land — no structure to rehab");
  } else if (p.sqft && p.sqft > 100) {
    repairEstimate = Math.round(p.sqft * REPAIR_PSF[rehabLevel]);
    notes.push(
      `Repairs ≈ ${p.sqft.toLocaleString()} sqft × $${REPAIR_PSF[rehabLevel]}/sqft (${rehabLevel})`,
    );
  } else {
    notes.push("Repair estimate needs square footage");
  }

  // ARV preference: explicit property-level ARV (true comps) > sqft × Redfin median *sale* $/sqft
  // (real sold data, regional → medium confidence) > sqft × coarse hardcoded reference (low). No sqft ⇒
  // unknown (don't guess). An injected opts.psf is treated as a market $/sqft (medium confidence).
  let arv: number | null = null;
  let arvBasis: HousingAnalysis["arvBasis"] = "unknown";
  let arvConfidence: HousingAnalysis["arvConfidence"] = "none";
  if (opts.arv && opts.arv > 0) {
    arv = Math.round(opts.arv);
    arvBasis = "comps";
    arvConfidence = "high";
    notes.push("ARV provided");
  } else if (p.property_type !== "land" && p.sqft && p.sqft > 100) {
    const stateCode = (p.state || "").toUpperCase();
    const sold =
      opts.psf && opts.psf > 0
        ? opts.psf
        : marketPsf(stateCode, p.property_type, p.zip);
    if (sold != null && sold > 0) {
      arv = Math.round(p.sqft * sold);
      arvBasis = "market_psf";
      arvConfidence = "medium";
      notes.push(
        `ARV ≈ ${p.sqft.toLocaleString()} sqft × $${sold}/sqft (Redfin median sale $/sqft, ${stateCode || "US"} — regional, confirm with comps)`,
      );
    } else {
      const psf = STATE_PSF[stateCode] || NATIONAL_PSF;
      arv = Math.round(p.sqft * psf);
      arvBasis = "regional_psf";
      arvConfidence = "low";
      notes.push(
        `ARV ≈ ${p.sqft.toLocaleString()} sqft × $${psf}/sqft regional reference (rough — confirm with comps)`,
      );
    }
  } else {
    notes.push("ARV needs square footage or comps");
  }

  // 70% rule.
  let mao: number | null = null;
  let equitySpread: number | null = null;
  let verdict: HousingAnalysis["verdict"] = "unknown";
  if (arv != null && repairEstimate != null) {
    mao = Math.round(arv * 0.7 - repairEstimate);
    equitySpread = Math.round(arv - askPrice - repairEstimate);
    if (askPrice <= mao * 0.85) verdict = "strong";
    else if (askPrice <= mao) verdict = "fair";
    else if (askPrice <= arv * 0.75) verdict = "tight";
    else verdict = "pass";
  }

  return {
    askPrice,
    rehabLevel,
    repairEstimate,
    arv,
    arvBasis,
    arvConfidence,
    mao,
    equitySpread,
    verdict,
    notes,
  };
}
