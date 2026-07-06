import { Worker, Queue } from "bullmq";
import { checkAlerts } from "../lib/alerts/alert-engine";
import { trackPriceChanges } from "../lib/alerts/price-tracker";
import { updateMarketTrends } from "../lib/scoring/market-intelligence";
import { checkSavedCars } from "../workers/savedCarsChecker";
import { scanForFlashDeals } from "../lib/alerts/flash-deal-scanner";
import { runPhotoStorageSync } from "../lib/alerts/photo-sync-job";
import { runPhotoStorageCleanup } from "../lib/alerts/photo-cleanup-job";
import { runHousingHarvest } from "../lib/housing/harvest-runner";

// Optional self-hosted worker for the recurring maintenance jobs that aren't a good fit for
// serverless: alert delivery, price-drop tracking, and nightly market-trend aggregation.
// Scraping/ingestion runs on GitHub Actions (see .github/workflows), NOT here.

const redisUrl =
  process.env.UPSTASH_REDIS_URL ||
  process.env.REDIS_URL ||
  "redis://localhost:6379";

const connection = {
  url: redisUrl,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
} as any;

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    "[Worker] Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
  );
}

export const maintenanceQueue = new Queue("maintenance", { connection });

async function scheduleJobs() {
  try {
    // Clear existing repeatables FIRST. BullMQ keys a repeatable by its cron pattern, so changing a pattern
    // ADDS a second schedule instead of replacing it — the old + new cadence would both fire. Removing them
    // up front makes the schedule below the single source of truth (so the cadence reductions actually apply).
    const existingRepeatables = await maintenanceQueue.getRepeatableJobs();
    for (const r of existingRepeatables) {
      await maintenanceQueue.removeRepeatableByKey(r.key);
    }

    await maintenanceQueue.add(
      "alert-check",
      {},
      { repeat: { pattern: "*/15 * * * *" }, attempts: 3 },
    );
    await maintenanceQueue.add(
      "price-track",
      {},
      { repeat: { pattern: "*/20 * * * *" }, attempts: 2 },
    );
    await maintenanceQueue.add(
      "market-intelligence",
      {},
      { repeat: { pattern: "0 2 * * *" }, attempts: 2 },
    );
    await maintenanceQueue.add(
      "saved-car-check",
      {},
      { repeat: { pattern: "*/15 * * * *" }, attempts: 2 },
    );
    await maintenanceQueue.add(
      "flash-deal-scan",
      {},
      { repeat: { pattern: "*/15 * * * *" }, attempts: 3 },
    );
    await maintenanceQueue.add(
      "photo-storage-sync",
      {},
      { repeat: { pattern: "*/15 * * * *" }, attempts: 2 },
    );
    await maintenanceQueue.add(
      "photo-storage-cleanup",
      {},
      { repeat: { pattern: "0 3 * * *" }, attempts: 2 },
    );
    // HOUSING HARVEST — every 3h, ingest all free housing sources into `properties`. Off-market distress
    // data (tax liens, foreclosures, code violations, county records) changes slowly — daily at most — so a
    // 30-min re-scrape was ~6× more DB write volume than the data warrants (it dominated Supabase requests:
    // /rest/v1/properties). 3h keeps leads fresh while cutting the biggest usage driver by ~6×.
    await maintenanceQueue.add(
      "housing-harvest",
      {},
      {
        repeat: { pattern: "0 */3 * * *" },
        attempts: 2,
        backoff: { type: "exponential", delay: 60_000 },
      },
    );
    // CARS HARVEST — every 2h. GitHub Actions ingestion is dead (billing); cars must ingest HERE too or
    // the deals table slowly drains (the nightly prune deletes stale rows with nothing refilling). Needs
    // the box's headed-Chrome fleet (Dockerfile.scraper / ENABLE_HEADED_SCRAPERS) to clear anti-bot.
    await maintenanceQueue.add(
      "cars-harvest",
      {},
      {
        repeat: { pattern: "20 */2 * * *" }, // offset from housing's :00/:30
        attempts: 1,
      },
    );
    // HOUSING PRICING — every 6h, harvest recent SOLD comps and write per-ZIP median sold $/sqft so ARV
    // learns from our own live data (the static snapshot becomes the floor, not the ceiling). Sold $/sqft
    // is stable, so 6h is plenty; runs separate from the 30-min lead harvest.
    await maintenanceQueue.add(
      "housing-pricing",
      {},
      { repeat: { pattern: "40 */6 * * *" }, attempts: 1 },
    );
    console.log("[Queue] Maintenance jobs scheduled");
  } catch (err) {
    console.error("[Queue] Failed to schedule jobs. Is Redis running?", err);
  }
}

const worker = new Worker(
  "maintenance",
  async (job) => {
    console.log(`[Worker] Processing job: ${job.name}`);
    switch (job.name) {
      case "photo-storage-sync":
        await runPhotoStorageSync();
        break;
      case "photo-storage-cleanup":
        await runPhotoStorageCleanup();
        break;
      case "alert-check":
        await checkAlerts();
        return;
      case "price-track": {
        const priceChanges = await trackPriceChanges();
        console.log(`[Worker] Tracked ${priceChanges.length} price changes`);
        return;
      }
      case "market-intelligence": {
        const trendsUpdated = await updateMarketTrends();
        console.log(`[Worker] Updated ${trendsUpdated} market trends`);
        return;
      }
      case "saved-car-check": {
        const savedCarCount = await checkSavedCars();
        console.log(`[Worker] Checked ${savedCarCount} saved cars`);
        return;
      }
      case "flash-deal-scan": {
        const flashDealsFound = await scanForFlashDeals();
        console.log(
          `[Worker] Found and alerted ${flashDealsFound} flash deals`,
        );
        return;
      }
      case "housing-harvest": {
        const r = await runHousingHarvest();
        console.log(
          `[Worker] Housing harvest: ${r.harvested} found, ${r.written} written —`,
          JSON.stringify(r.sources),
        );
        return;
      }
      case "cars-harvest": {
        // Ingest the cars `deals` table (the housing-harvest twin). Dynamic import mirrors scrape-ci so
        // adaptive source setup resolves first; tear down the warm browsers after.
        const { runScrapers } = await import("../lib/scrapers/runner");
        const results = await runScrapers({
          orchestrator: "concurrent",
          concurrency: 3,
          dryRun: false,
        });
        const { closeSmartFetch } = await import("../lib/scrapers/smart-fetch");
        await closeSmartFetch().catch(() => {});
        const found = Array.isArray(results)
          ? results.reduce((s: number, r: any) => s + (r?.dealsFound || 0), 0)
          : 0;
        console.log(`[Worker] Cars harvest: ${found} deals across sources`);
        return;
      }
      case "housing-pricing": {
        const { refreshSoldPsf } = await import("../lib/housing/live-psf");
        const { closeSmartFetch } = await import("../lib/scrapers/smart-fetch");
        const n = await refreshSoldPsf();
        await closeSmartFetch().catch(() => {});
        console.log(`[Worker] Housing pricing: ${n} ZIP sold-$/sqft medians`);
        return;
      }
      default:
        console.warn(`[Worker] Unknown job: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 3,
    limiter: { max: 10, duration: 1000 },
  },
);

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.name} failed after retries:`, err.message);
});

worker.on("error", (err) => {
  console.error(`[Worker] Connection Error:`, err);
});

scheduleJobs().then(() => {
  console.log(
    "[DealerHunt Worker] Running (maintenance jobs). Press Ctrl+C to stop.",
  );
});
