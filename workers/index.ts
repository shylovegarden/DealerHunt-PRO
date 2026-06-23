import { Worker, Queue } from "bullmq";
import { checkAlerts } from "../lib/alerts/alert-engine";
import { trackPriceChanges } from "../lib/alerts/price-tracker";
import { updateMarketTrends } from "../lib/scoring/market-intelligence";
import { checkSavedCars } from "../workers/savedCarsChecker";
import { scanForFlashDeals } from "../lib/alerts/flash-deal-scanner";

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
    await maintenanceQueue.add(
      "alert-check",
      {},
      { repeat: { pattern: "*/5 * * * *" }, attempts: 3 },
    );
    await maintenanceQueue.add(
      "price-track",
      {},
      { repeat: { pattern: "*/10 * * * *" }, attempts: 2 },
    );
    await maintenanceQueue.add(
      "market-intelligence",
      {},
      { repeat: { pattern: "0 2 * * *" }, attempts: 2 },
    );
    await maintenanceQueue.add(
      "saved-car-check",
      {},
      { repeat: { pattern: "*/5 * * * *" }, attempts: 2 },
    );
    await maintenanceQueue.add(
      "flash-deal-scan",
      {},
      { repeat: { pattern: "*/5 * * * *" }, attempts: 3 },
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
