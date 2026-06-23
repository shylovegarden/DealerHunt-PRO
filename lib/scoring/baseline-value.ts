// Free, offline baseline resale estimate (no paid API). Segment new-value × an age depreciation
// curve × a mileage adjustment. Used two ways in the analyzer: as the resale estimate when we have
// no trustworthy comps (instead of the old circular ask×1.25), and as a SANITY GATE so a single
// outlier comp (e.g. a $42k Shelby polluting base-V6 "Mustang") can't set a wild resale value.
// Pure + deterministic.

type Segment =
  | "fullsize_truck"
  | "midsize_truck"
  | "fullsize_suv"
  | "midsize_suv"
  | "compact_suv"
  | "sports"
  | "luxury"
  | "minivan"
  | "sedan";

const BASE_NEW: Record<Segment, number> = {
  fullsize_truck: 42000,
  midsize_truck: 32000,
  fullsize_suv: 48000,
  midsize_suv: 34000,
  compact_suv: 26000,
  sports: 34000,
  luxury: 45000,
  minivan: 33000,
  sedan: 24000,
};

const has = (s: string, ...needles: string[]) =>
  needles.some((n) => s.includes(n));

export function classifySegment(make: string, model: string): Segment {
  const m = (model || "").toLowerCase();
  const mk = (make || "").toLowerCase();

  if (
    has(
      m,
      "f-250",
      "f250",
      "f-350",
      "f350",
      "f-150",
      "f150",
      "silverado 1500",
      "silverado",
      "sierra",
      "ram 1500",
      "ram 2500",
      "ram 3500",
      "tundra",
      "titan",
    )
  )
    return has(m, "250", "350", "2500", "3500", "hd")
      ? "fullsize_truck"
      : "fullsize_truck";
  if (
    has(
      m,
      "tacoma",
      "ranger",
      "colorado",
      "canyon",
      "frontier",
      "ridgeline",
      "gladiator",
    )
  )
    return "midsize_truck";
  if (
    has(
      m,
      "sequoia",
      "tahoe",
      "suburban",
      "yukon",
      "expedition",
      "navigator",
      "escalade",
      "armada",
      "wagoneer",
    )
  )
    return "fullsize_suv";
  if (
    has(
      m,
      "4runner",
      "pilot",
      "highlander",
      "explorer",
      "grand cherokee",
      "traverse",
      "durango",
      "pathfinder",
      "telluride",
      "palisade",
      "tahoe",
    )
  )
    return "midsize_suv";
  if (
    has(
      m,
      "rav4",
      "cr-v",
      "crv",
      "escape",
      "rogue",
      "equinox",
      "tucson",
      "sportage",
      "cx-5",
      "forester",
      "wrangler",
    )
  )
    return "compact_suv";
  if (
    has(
      m,
      "mustang",
      "camaro",
      "corvette",
      "challenger",
      "charger",
      "supra",
      "gt-r",
      "miata",
      "86",
      "brz",
    )
  )
    return "sports";
  if (has(m, "odyssey", "sienna", "pacifica", "carnival", "grand caravan"))
    return "minivan";
  if (
    has(
      mk,
      "bmw",
      "mercedes",
      "audi",
      "lexus",
      "porsche",
      "cadillac",
      "lincoln",
      "jaguar",
      "land rover",
      "infiniti",
      "acura",
    )
  )
    return "luxury";
  return "sedan";
}

/** Realistic resale value from age + mileage, no external data. */
export function estimateBaselineValue(
  year: number | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined,
  mileage?: number | null,
): number {
  if (!year || year < 1950) return 0;
  const seg = classifySegment(make || "", model || "");
  let value = BASE_NEW[seg];

  const nowYear = 2026;
  const age = Math.max(0, Math.min(25, nowYear - year));
  for (let i = 0; i < age; i++) {
    const rate = i === 0 ? 0.16 : i <= 2 ? 0.12 : i <= 5 ? 0.1 : 0.08;
    value *= 1 - rate;
  }

  // Mileage adjustment vs a 13k/yr baseline; over-mileage docks ~3% of value per 10k excess.
  if (mileage && mileage > 0) {
    const expected = age * 13000;
    const excess = mileage - expected;
    if (excess > 0) value -= (excess / 10000) * value * 0.03;
  }

  return Math.max(1200, Math.round(value));
}
