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
import { marketPsfDetailed } from "./arv-psf";

export type RehabLevel = "light" | "medium" | "heavy" | "gut";

// Industry rule-of-thumb rehab cost per sqft (cosmetic → full gut). Real reference figures flippers use.
// Exported so the client-side offer solver recomputes repairs from the SAME table (one source of truth, no
// drift) when the user dials the rehab level up/down. These are an ASSUMPTION, not harvested data — always
// labeled as such in the UI.
export const REPAIR_PSF: Record<RehabLevel, number> = {
  light: 18, // paint, carpet, fixtures
  medium: 38, // kitchen/bath refresh, some systems
  heavy: 60, // major systems + layout
  gut: 90, // down to studs
};

// The 70%-rule discount — Max Allowable Offer = ARV × MAO_RULE − repairs. Exported for the solver.
export const MAO_RULE = 0.7;

// Human label for each rehab level, for the solver + UI.
export const REHAB_LABEL: Record<RehabLevel, string> = {
  light: "Cosmetic",
  medium: "Kitchen/bath refresh",
  heavy: "Major systems",
  gut: "Full gut",
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

export type FlipVerdict = "strong" | "fair" | "tight" | "pass" | "unknown";

export interface HousingAnalysis {
  askPrice: number;
  rehabLevel: RehabLevel;
  repairEstimate: number | null;
  repairPsf: number | null; // the $/sqft used for repairs (so the UI can show "× $X/sqft")
  arv: number | null;
  arvBasis: "regional_psf" | "market_psf" | "comps" | "unknown";
  arvConfidence: "high" | "medium" | "low" | "none";
  arvPsf: number | null; // the median sale $/sqft ARV was built from
  // How the ARV $/sqft was sourced: our own fresh harvested sold comps ("live"), the committed Redfin
  // snapshot ("snapshot"), a coarse hardcoded regional reference ("regional"), or a caller-provided true
  // ARV ("provided"). This is the backbone of the "learning, not fabricating" disclosure.
  arvSource: "live" | "snapshot" | "regional" | "provided" | null;
  arvComps: number | null; // real closed-comp count behind a live median (when known)
  mao: number | null; // Max Allowable Offer = ARV*0.70 - repairs
  equitySpread: number | null; // ARV - ask - repairs (gross potential)
  verdict: FlipVerdict;
  notes: string[];
}

/**
 * The 70%-rule verdict from a fully-computed deal. Pure + exported so the client offer-solver reaches the
 * SAME conclusion when the user tweaks rehab/margin. A coarse (low-confidence) ARV is capped at "tight" —
 * never presented as a verified "strong"/"fair" flip on a guessed $/sqft.
 */
export function flipVerdict(
  askPrice: number,
  arv: number,
  mao: number,
  equitySpread: number,
  arvConfidence: HousingAnalysis["arvConfidence"],
): FlipVerdict {
  let verdict: FlipVerdict;
  if (askPrice <= mao * 0.85) verdict = "strong";
  else if (askPrice <= mao) verdict = "fair";
  else if (askPrice <= arv * 0.75 && equitySpread > 0) verdict = "tight";
  else verdict = "pass";
  if (arvConfidence === "low" && (verdict === "strong" || verdict === "fair"))
    verdict = "tight";
  return verdict;
}

/** Infer the rehab level from the listing language + distress signals (distressed shells skew gut/heavy). */
export function inferRehabLevel(p: Property): RehabLevel {
  const t = `${p.title || ""} ${p.description || ""}`;
  const sig = (p.signals as any) || {};
  // Condemned / dangerous / vacant-abandoned structures are gut jobs regardless of listing wording.
  if (GUT_RE.test(t) || sig.dangerous) return "gut";
  if (LIGHT_RE.test(t)) return "light";
  if (HEAVY_RE.test(t)) return "heavy";
  // Distressed off-market shells (land bank, vacant, REO, foreclosure) and gov/bank disposal need real work.
  if (
    sig.land_bank ||
    sig.vacant ||
    sig.reo ||
    sig.foreclosure ||
    p.seller_type === "gov" ||
    p.seller_type === "bank"
  )
    return "heavy";
  return "medium"; // unknown fixer — assume meaningful work
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
  let repairPsf: number | null = null;
  if (p.property_type === "land") {
    repairEstimate = 0;
    notes.push("Land — no structure to rehab");
  } else if (p.sqft && p.sqft > 100) {
    repairPsf = REPAIR_PSF[rehabLevel];
    repairEstimate = Math.round(p.sqft * repairPsf);
    notes.push(
      `Repairs ≈ ${p.sqft.toLocaleString()} sqft × $${repairPsf}/sqft (${rehabLevel})`,
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
  let arvPsf: number | null = null;
  let arvSource: HousingAnalysis["arvSource"] = null;
  let arvComps: number | null = null;
  if (opts.arv && opts.arv > 0) {
    arv = Math.round(opts.arv);
    arvBasis = "comps";
    arvConfidence = "high";
    arvSource = "provided";
    notes.push("ARV provided");
  } else if (p.property_type !== "land" && p.sqft && p.sqft > 100) {
    const stateCode = (p.state || "").toUpperCase();
    const detail =
      opts.psf && opts.psf > 0
        ? {
            psf: opts.psf,
            level: "county" as const,
            source: "snapshot" as const,
          } // injected = treat as comp-grade
        : marketPsfDetailed(stateCode, p.property_type, p.zip);
    if (detail != null && detail.psf > 0) {
      arv = Math.round(p.sqft * detail.psf);
      arvPsf = detail.psf;
      arvSource = detail.source;
      arvComps = ("comps" in detail ? detail.comps : undefined) ?? null;
      arvBasis = detail.level === "zip" ? "comps" : "market_psf";
      // ZIP median = tightest free comp (street-level) → high. County median = comp-grade (medium). STATE
      // median is a coarse regional guess (low) — a derelict land-bank shell and a metro home share one
      // statewide number, so don't over-trust it.
      arvConfidence =
        detail.level === "zip"
          ? "high"
          : detail.level === "county"
            ? "medium"
            : "low";
      notes.push(
        detail.level === "zip"
          ? `ARV ≈ ${p.sqft.toLocaleString()} sqft × $${detail.psf}/sqft (ZIP ${p.zip} median sale $/sqft — comp-grade)`
          : detail.level === "county"
            ? `ARV ≈ ${p.sqft.toLocaleString()} sqft × $${detail.psf}/sqft (county median sale $/sqft — confirm with comps)`
            : `ARV ≈ ${p.sqft.toLocaleString()} sqft × $${detail.psf}/sqft (${stateCode || "US"} STATEWIDE median — coarse, needs local comps)`,
      );
    } else {
      const psf = STATE_PSF[stateCode] || NATIONAL_PSF;
      arv = Math.round(p.sqft * psf);
      arvPsf = psf;
      arvSource = "regional";
      arvBasis = "regional_psf";
      arvConfidence = "low";
      notes.push(
        `ARV ≈ ${p.sqft.toLocaleString()} sqft × $${psf}/sqft regional reference (rough — confirm with comps)`,
      );
    }
  } else {
    notes.push("ARV needs square footage or comps");
  }

  // Distressed SHELLS (land bank / condemned / vacant-abandoned) sit in the worst micro-markets that even a
  // county median over-states, and they're gut jobs — without REAL comps, never trust the $/sqft ARV enough
  // to call it a flip. (This is what put $1,000 Detroit land-bank shells on top with a fabricated spread.)
  const sig = (p.signals as any) || {};
  if (arvBasis !== "comps" && (sig.land_bank || sig.dangerous || sig.vacant)) {
    arvConfidence = "low";
    if (arv != null)
      notes.push(
        "Distressed shell — $/sqft ARV unreliable here; verify with local comps",
      );
  }

  // 70% rule — MAO + equity, then the shared verdict (also used by the client solver).
  let mao: number | null = null;
  let equitySpread: number | null = null;
  let verdict: FlipVerdict = "unknown";
  if (arv != null && repairEstimate != null) {
    mao = Math.round(arv * MAO_RULE - repairEstimate);
    equitySpread = Math.round(arv - askPrice - repairEstimate);
    verdict = flipVerdict(askPrice, arv, mao, equitySpread, arvConfidence);
  }

  return {
    askPrice,
    rehabLevel,
    repairEstimate,
    repairPsf,
    arv,
    arvBasis,
    arvConfidence,
    arvPsf,
    arvSource,
    arvComps,
    mao,
    equitySpread,
    verdict,
    notes,
  };
}
