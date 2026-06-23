/**
 * scrape-ci.ts — CI/cron entrypoint for the $0 scraping engine.
 *
 * Designed to run on GitHub Actions (free 2,000 min/month, full Chromium) rather
 * than Vercel serverless (which cannot run a browser). It executes the concurrent
 * orchestrator against the enabled sources and writes real deals into Supabase via
 * the existing pipeline (normalize → quality → score → upsert → dedupe → match).
 *
 * Source selection (in priority order):
 *   1. CLI args:           npm run scrape:ci -- craigslist cars_com
 *   2. SCRAPE_SOURCES env: SCRAPE_SOURCES="craigslist,cars_com"
 *   3. Default curated $0-friendly set (no paid auth / proxies required).
 *
 * Exit codes: 0 on any success (partial blocks are expected for some sources);
 * 1 only if every requested source failed, which signals a real breakage.
 */
import * as dotenv from "dotenv";
import path from "path";

// Load env BEFORE importing the scraper — the Craigslist module resolves its city list at import,
// so adaptive selection (below) must set CL_CITIES first. Hence runScrapers is imported dynamically.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// $0-friendly defaults: no dealer login, no paid proxy. Copart uses FlareSolverr (free).
const DEFAULT_SOURCES = [
  "craigslist",
  "cars_com",
  "ebay_motors",
  "independent_dealer",
  "copart",
];

function resolveSources(): string[] {
  const fromArgs = process.argv.slice(2).filter(Boolean);
  if (fromArgs.length) return fromArgs;
  const fromEnv = process.env.SCRAPE_SOURCES?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv?.length) return fromEnv;
  return DEFAULT_SOURCES;
}

// Fetch real detail-page photos/VIN/mileage for active GO deals that still lack images.
async function enrichGoBacklog(limit: number): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const { enrichCraigslistDetail } =
    await import("../lib/scrapers/sources/index");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data } = await sb
    .from("deals")
    .select("id, source_url, vin")
    .eq("active", true)
    .eq("deal_verdict", "go")
    .in("source", ["craigslist", "craigslist_dealer"])
    .not("source_url", "is", null)
    .or("images.is.null,images.eq.{}")
    .order("profit_score", { ascending: false, nullsFirst: false })
    .limit(limit);
  let n = 0;
  for (const d of data || []) {
    try {
      const extra = await enrichCraigslistDetail(d.source_url as string);
      const patch: any = {};
      if (Array.isArray(extra.images) && extra.images.length)
        patch.images = extra.images.slice(0, 12);
      if (extra.vin && !d.vin) patch.vin = extra.vin;
      if (extra.mileage) patch.mileage = extra.mileage;
      if (Object.keys(patch).length) {
        await sb.from("deals").update(patch).eq("id", d.id);
        n++;
      }
    } catch {
      /* skip */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (n) console.log(`🖼️  topped up ${n} GO deals with real photos/VIN`);
}

// Decode + canonicalize active deals whose VINs haven't been decoded yet — cleans make/model and
// adds the real trim from NHTSA (VIN = ground truth). Bounded per cycle; converges over time.
async function canonicalizeNew(limit: number): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const { decodeVin } = await import("../lib/vehicle/nhtsa");
  const { isValidVin } = await import("../lib/vehicle/vin");
  const { titleCaseMake, canonicalModel } =
    await import("../lib/vehicle/canonical");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: deals } = await sb
    .from("deals")
    .select("id, vin, make, model, trim")
    .eq("active", true)
    .not("vin", "is", null)
    .neq("vin", "")
    .order("profit_score", { ascending: false, nullsFirst: false })
    .limit(400);
  if (!deals?.length) return;

  const vins = Array.from(new Set(deals.map((d) => d.vin)));
  const { data: existing } = await sb
    .from("vin_decodes")
    .select("vin")
    .in("vin", vins);
  const done = new Set((existing || []).map((d) => d.vin));

  let n = 0;
  for (const d of deals) {
    if (n >= limit) break;
    if (!d.vin || done.has(d.vin) || !isValidVin(d.vin)) continue;
    const dec = await decodeVin(d.vin);
    if (dec?.make && dec.model) {
      try {
        await sb.from("vin_decodes").upsert(
          {
            vin: d.vin,
            make: dec.make,
            model: dec.model,
            trim: dec.trim,
            body_class: dec.bodyClass,
            drive_type: dec.driveType,
            fuel_type: dec.fuelType,
            cylinders: dec.cylinders,
            displacement_l: dec.displacementL,
            plant_country: dec.plantCountry,
            made_in_usa: dec.madeInUsa,
          },
          { onConflict: "vin" },
        );
      } catch {
        /* ignore */
      }
      const make = titleCaseMake(dec.make);
      const model = canonicalModel(dec.model);
      const patch: any = {};
      if (make && make !== d.make) patch.make = make;
      if (model && model !== d.model) patch.model = model;
      if (dec.trim && !d.trim) patch.trim = dec.trim;
      // Denormalize decoded signals onto the deal for the grid cards.
      if (dec.bodyClass) patch.body_class = dec.bodyClass;
      if (dec.plantCountry) patch.assembly_country = dec.plantCountry;
      if (Object.keys(patch).length)
        await sb.from("deals").update(patch).eq("id", d.id);
      n++;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  if (n) console.log(`🏷️  canonicalized ${n} deals from VIN`);
}

async function main() {
  const sources = resolveSources();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error(
      "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot persist deals.",
    );
    process.exit(1);
  }
  if (!process.env.FLARESOLVERR_URL) {
    console.warn(
      "⚠️  FLARESOLVERR_URL not set — Cloudflare-gated sources (Copart) may be blocked.",
    );
  }

  // Adaptive scheduling: scrape the stalest cities first (unless CL_CITIES is explicitly pinned).
  if (
    process.env.CL_ADAPTIVE === "1" &&
    sources.includes("craigslist") &&
    !process.env.CL_CITIES
  ) {
    try {
      const { rankCitiesByStaleness, recommendBatchSize } =
        await import("../lib/scrapers/adaptive");
      const ranked = await rankCitiesByStaleness();
      if (ranked.length) {
        // Freshness-aware cadence: explicit count wins, else scale to how far behind we are.
        const explicit = parseInt(process.env.CL_ADAPTIVE_COUNT || "0", 10);
        const count = explicit > 0 ? explicit : recommendBatchSize(ranked);
        const cities = ranked.slice(0, count).map((c) => c.site);
        process.env.CL_CITIES = cities.join(",");
        const staleCount = ranked.filter(
          (c) => c.ageHours == null || c.ageHours > 4,
        ).length;
        console.log(
          `🧭 adaptive: ${staleCount} stale of ${ranked.length} → scraping ${cities.length} → ${cities.slice(0, 6).join(", ")}…`,
        );
      }
    } catch (e) {
      console.warn("adaptive selection failed; using default rotation:", e);
    }
  }

  console.log(`🚀 scrape:ci starting — sources: ${sources.join(", ")}`);
  const startedAt = Date.now();

  // Dynamic import so the adaptive CL_CITIES above is in place before the scraper resolves cities.
  const { runScrapers } = await import("../lib/scrapers/runner");
  const results = await runScrapers({
    orchestrator: "concurrent",
    sourceIds: sources,
    concurrency: 3,
    dryRun: false,
    onSourceComplete: (r) => {
      const icon = r.success ? "✅" : "❌";
      console.log(
        `${icon} ${r.source}: ${r.dealsFound} deals in ${Math.round(r.duration / 1000)}s${r.error ? ` — ${r.error}` : ""}`,
      );
    },
  });

  // Self-sustaining photo coverage: top up GO deals that still lack images by fetching their real
  // detail page. Keeps the surfaces the dealer sees fully illustrated, every cycle. Real data only.
  if (sources.includes("craigslist")) {
    try {
      await enrichGoBacklog(parseInt(process.env.GO_ENRICH_MAX || "30", 10));
    } catch (e) {
      console.warn("GO photo top-up skipped:", (e as Error).message);
    }
    try {
      await canonicalizeNew(parseInt(process.env.CANON_MAX || "40", 10));
    } catch (e) {
      console.warn("canonicalize skipped:", (e as Error).message);
    }
  }

  const totalDeals = results.reduce((sum, r) => sum + (r.dealsFound || 0), 0);
  const succeeded = results.filter((r) => r.success).length;
  const durationS = Math.round((Date.now() - startedAt) / 1000);

  console.log("\n──────── scrape:ci summary ────────");
  console.table(
    results.map((r) => ({
      source: r.source,
      ok: r.success,
      deals: r.dealsFound,
      error: r.error || "",
    })),
  );
  console.log(
    `Total: ${totalDeals} deals from ${succeeded}/${results.length} sources in ${durationS}s`,
  );

  if (succeeded === 0) {
    console.error("❌ All sources failed — exiting non-zero.");
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ scrape:ci crashed:", err);
  process.exit(1);
});
