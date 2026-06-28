// Backfill precise lat/lng for HOUSES already in `properties` that landed before geocoding was wired
// (or whose harvest left coords null). Pulls rows missing coordinates but carrying a usable zip/city/state,
// resolves them through the SHARED free geocoder (Nominatim/Zippopotam, cached in geocode_cache), and
// writes the coords back. Idempotent + bounded: dry-run by default, capped lookups/run so the cache grows
// without hammering. HOUSES-ONLY — never touches `deals` (vertical isolation).
//
//   npx tsx scripts/backfill-property-geocodes.ts          # dry-run: report coverage + what would resolve
//   npx tsx scripts/backfill-property-geocodes.ts --apply  # write resolved coords back
//   npx tsx scripts/backfill-property-geocodes.ts --apply --max 200
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolvePlaces, placeKey } from "../lib/geo/geocode";
config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APPLY = process.argv.includes("--apply");
const maxArg = process.argv.indexOf("--max");
const MAX_LOOKUPS = maxArg > -1 ? Number(process.argv[maxArg + 1]) || 150 : 150;

async function main() {
  // Whole-table coverage snapshot first (honest before/after).
  const { count: total } = await sb
    .from("properties")
    .select("id", { count: "exact", head: true });
  const { count: precise } = await sb
    .from("properties")
    .select("id", { count: "exact", head: true })
    .not("lat", "is", null)
    .not("lng", "is", null);
  console.log(
    `coverage: ${precise ?? 0}/${total ?? 0} properties have lat/lng`,
  );

  // Candidates: missing coords but a usable place (zip OR city+state). Bounded fetch.
  const { data, error } = await sb
    .from("properties")
    .select("id, zip, city, state, lat, lng")
    .or("lat.is.null,lng.is.null")
    .limit(2000);
  if (error) throw error;

  const candidates = (data || []).filter((r) =>
    placeKey({ zip: r.zip, city: r.city, state: r.state }),
  );
  console.log(
    `candidates missing coords with a usable place: ${candidates.length}`,
  );
  if (!candidates.length) return;

  // Resolve unique places through the shared cache (capped per run; 1.1s delay = polite to Nominatim).
  const coords = await resolvePlaces(
    sb,
    candidates.map((r) => ({ zip: r.zip, city: r.city, state: r.state })),
    { maxLookups: MAX_LOOKUPS, delayMs: 1100 },
  );
  console.log(`resolved ${coords.size} unique places this run`);

  let wrote = 0;
  for (const r of candidates) {
    const k = placeKey({ zip: r.zip, city: r.city, state: r.state });
    const c = k ? coords.get(k) : undefined;
    if (!c) continue;
    if (!APPLY) {
      wrote++;
      continue;
    }
    const { error: upErr } = await sb
      .from("properties")
      .update({ lat: c.lat, lng: c.lng })
      .eq("id", r.id);
    if (!upErr) wrote++;
  }
  console.log(
    APPLY
      ? `DONE: wrote coords to ${wrote} properties`
      : `DRY-RUN: ${wrote} properties would get coords — re-run with --apply`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
