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
      const { selectStaleCities } = await import("../lib/scrapers/adaptive");
      const count = parseInt(process.env.CL_ADAPTIVE_COUNT || "14", 10);
      const cities = await selectStaleCities(count);
      if (cities.length) {
        process.env.CL_CITIES = cities.join(",");
        console.log(
          `🧭 adaptive: ${cities.length} stalest cities → ${cities.slice(0, 6).join(", ")}…`,
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
