// lib/vehicle/vin-history.ts
// VIN history — the missing "should I buy" piece (prior salvage/accidents/title brands). There is no
// free ANONYMOUS authoritative source (NMVTIS is provider-gated, salvage-auction sites are Cloudflare-
// walled), so this is TIERED with fallbacks so we always have an answer:
//   Tier 1 (free, always)   — mine the listing text + our condition/damage for title brands + clean-
//                             history claims. Catches what the seller disclosed; $0, instant.
//   Tier 2 (key-gated)      — VinAudit NMVTIS API: authoritative brands/total-loss/theft/odometer.
//   Tier 3 (FlareSolverr)   — salvage-auction history (was this VIN at Copart/IAA) — future.
// The point: a flipper instantly sees the red flags, and the authoritative report layers in when a
// key is set — never a hard dependency on one source.

export interface VinHistory {
  source: "nmvtis" | "listing-text" | "none";
  authoritative: boolean; // true only for NMVTIS — UI should label estimates as "claimed"
  titleBrands: string[]; // red flags found (salvage, rebuilt, flood, …)
  cleanClaims: string[]; // "no accidents", "clean Carfax", "1 owner" (claimed unless authoritative)
  owners?: number;
  note: string;
}

// Title-brand red flags (ordered most→least severe). Source text is title + condition + damage + notes.
const BRANDS: Array<[RegExp, string]> = [
  [
    /\bjunk\b|certificate of destruction|\bcod\b/i,
    "Junk / certificate of destruction",
  ],
  [/\bsalvage(d)?\b|salvage_title/i, "Salvage title"],
  [/flood|water damage/i, "Flood damage"],
  [/\bfire\b|burn(t|ed)?/i, "Fire damage"],
  [/lemon|manufacturer buyback|\bbuyback\b/i, "Lemon / manufacturer buyback"],
  [/rebuilt|reconstructed|restored title/i, "Rebuilt / reconstructed"],
  [
    /prior salvage|previously salvage|branded title|salvage history/i,
    "Prior salvage / branded",
  ],
  [/frame damage|bent frame|structural damage/i, "Frame / structural damage"],
  [
    /odometer (rollback|discrepancy|tamper|problem)|true mileage unknown|\btmu\b|not actual miles/i,
    "Odometer issue",
  ],
  [/\bhail\b/i, "Hail damage"],
  [/theft recovery|recovered theft|stolen/i, "Theft recovery"],
];

/** Tier 1: history signals straight from the listing text we already have. Free, instant. */
export function historyFromText(parts: {
  title?: string | null;
  condition?: string | null;
  damageType?: string | null;
  notes?: string | null;
}): VinHistory {
  const hay = [parts.title, parts.condition, parts.damageType, parts.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const titleBrands = BRANDS.filter(([rx]) => rx.test(hay)).map(([, l]) => l);

  const cleanClaims: string[] = [];
  if (/clean (title|carfax|autocheck|history)/.test(hay))
    cleanClaims.push("Clean title/Carfax claimed");
  if (/no accidents|accident[-\s]?free|never wrecked/.test(hay))
    cleanClaims.push("No accidents claimed");
  if (/carfax (available|certified|report)/.test(hay))
    cleanClaims.push("Carfax available");

  let owners: number | undefined;
  const m = hay.match(/\b(\d)[\s-]*owner/);
  if (m) owners = parseInt(m[1], 10);
  else if (/\bone[\s-]?owner\b/.test(hay)) owners = 1;
  if (owners)
    cleanClaims.push(`${owners} owner${owners > 1 ? "s" : ""} claimed`);

  return {
    source: titleBrands.length || cleanClaims.length ? "listing-text" : "none",
    authoritative: false,
    titleBrands,
    cleanClaims,
    owners,
    note:
      titleBrands.length || cleanClaims.length
        ? "From the listing — a paid NMVTIS report confirms title brands & accidents."
        : "No history disclosed in the listing — run a full report to be sure.",
  };
}

const num = (v: unknown) =>
  Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;

/** Tier 2: VinAudit NMVTIS — authoritative. Gated on VINAUDIT_KEY (+ VINAUDIT_ID); null when unset. */
export async function fetchNmvtis(vin: string): Promise<VinHistory | null> {
  const key = process.env.VINAUDIT_KEY;
  const id = process.env.VINAUDIT_ID || "DEMO";
  if (!key || !vin || vin.length !== 17) return null;
  try {
    const res = await fetch(
      `https://api.vinaudit.com/v2/query?key=${key}&id=${encodeURIComponent(id)}&vin=${vin}&format=json`,
    );
    if (!res.ok) return null;
    const j: any = await res.json();
    if (j?.success === false) return null;

    const brandRecs: any[] = j?.brandrecords || j?.brands || [];
    const titleRecs: any[] = j?.titlerecords || [];
    const jsiRecs: any[] = j?.jsirecords || []; // junk/salvage/insurance (total-loss)

    const titleBrands = Array.from(
      new Set(
        [
          ...brandRecs.map((b) => String(b?.brand || b?.type || "").trim()),
          ...jsiRecs.map(
            (r) => `${r?.reportingentitytype || "Salvage"} total-loss record`,
          ),
        ].filter(Boolean),
      ),
    );
    // Distinct title states ≈ owner/registration changes (a rough but real owner signal).
    const owners =
      titleRecs.length > 0
        ? new Set(titleRecs.map((t) => `${t?.state}|${t?.date}`)).size
        : undefined;

    return {
      source: "nmvtis",
      authoritative: true,
      titleBrands,
      cleanClaims:
        titleBrands.length === 0 ? ["No title brands on record"] : [],
      owners,
      note: `NMVTIS report · ${titleRecs.length} title record${titleRecs.length === 1 ? "" : "s"}${
        num(j?.checks?.salvage) ? " · salvage flagged" : ""
      }`,
    };
  } catch {
    return null;
  }
}

/** Combined resolver: authoritative NMVTIS when a key is set, else the free listing-text tier. */
export async function getVinHistory(deal: {
  vin?: string | null;
  title?: string | null;
  condition?: string | null;
  damageType?: string | null;
  notes?: string | null;
}): Promise<VinHistory> {
  if (deal.vin && deal.vin.length === 17) {
    const nm = await fetchNmvtis(deal.vin);
    if (nm) return nm;
  }
  return historyFromText(deal);
}
