// lib/housing/calibration.ts
//
// The READ + INJECT half of the learning loop. Reads realized pipeline outcomes from saved_properties,
// summarizes them, and injects the resulting per-tier calibration into the scorer (setTierCalibration) so
// future scores bend toward what actually converts. Mirrors the live-psf pattern: a cached, best-effort
// loader called at the top of the scoring paths; a missing table / no data is a silent no-op (the scorer
// stays the pure hand-tuned heuristic until real outcomes exist — it never learns from a guess).

import { createClient } from "@supabase/supabase-js";
import {
  extractOutcomeRow,
  summarizeOutcomes,
  calibrationFromOutcomes,
  type OutcomeRow,
  type OutcomeSummary,
} from "./outcomes";
import { setTierCalibration } from "./lead-score";

let CACHE: { at: number; summary: OutcomeSummary } | null = null;
const TTL = 15 * 60_000;

/**
 * Load realized outcomes → inject the learned tier calibration into the scorer → return the summary (for
 * insights). Global (service-role) so the model learns from every closed/dead deal, not one user's. Cached;
 * safe to call at the top of every scoring path. Returns null if outcomes can't be read.
 */
export async function loadCalibration(): Promise<OutcomeSummary | null> {
  if (CACHE && Date.now() - CACHE.at < TTL) return CACHE.summary;
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        "",
    );
    const { data, error } = await sb
      .from("saved_properties")
      .select("status, snapshot");
    if (error) {
      setTierCalibration(null);
      return null;
    }
    const rows = (data || [])
      .map((r) => extractOutcomeRow(r as any))
      .filter((r): r is OutcomeRow => r != null);
    const summary = summarizeOutcomes(rows);
    setTierCalibration(calibrationFromOutcomes(summary));
    CACHE = { at: Date.now(), summary };
    return summary;
  } catch {
    setTierCalibration(null);
    return null;
  }
}
