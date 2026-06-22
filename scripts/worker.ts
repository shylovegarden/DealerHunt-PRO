import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import * as dotenv from "dotenv";
import { scrapeIAA } from "./scrapers/iaa";
import { scrapeCraigslist } from "./scrapers/craigslist";
import { runPipeline } from "./pipeline";

dotenv.config({ path: ".env.local" });

// Redis Connection
// Ensure REDIS_URL is in .env.local when deploying to Railway
const connection = new IORedis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  {
    maxRetriesPerRequest: null,
  },
);

const SCRAPER_QUEUE_NAME = "dealerhunt-scrapers";

// 1. Create the Queue
const scraperQueue = new Queue(SCRAPER_QUEUE_NAME, {
  connection: connection as any,
});

// 2. Schedule the Jobs
async function scheduleJobs() {
  console.log("[WORKER] Scheduling Cron Jobs...");

  // Run IAA every 15 minutes
  await scraperQueue.add(
    "scrape-iaa",
    {},
    {
      repeat: {
        pattern: "*/15 * * * *",
      },
    },
  );

  // Run Craigslist every 30 minutes
  await scraperQueue.add(
    "scrape-craigslist",
    {},
    {
      repeat: {
        pattern: "*/30 * * * *",
      },
    },
  );

  // Run Pipeline every 5 minutes to process new cars quickly
  await scraperQueue.add(
    "run-pipeline",
    {},
    {
      repeat: {
        pattern: "*/5 * * * *",
      },
    },
  );

  console.log("[WORKER] Jobs Scheduled.");
}

// 3. Define the Worker
const worker = new Worker(
  SCRAPER_QUEUE_NAME,
  async (job) => {
    console.log(`[WORKER] Starting job: ${job.name}`);

    if (job.name === "scrape-iaa") {
      await scrapeIAA();
    } else if (job.name === "scrape-craigslist") {
      await scrapeCraigslist();
    } else if (job.name === "run-pipeline") {
      await runPipeline();
    }

    console.log(`[WORKER] Completed job: ${job.name}`);
  },
  { connection: connection as any },
);

worker.on("failed", (job, err) => {
  console.error(`[WORKER] Job ${job?.name} failed:`, err.message);
});

// Setup
async function start() {
  console.log("[WORKER] Booting background queue processing...");

  // Clear old repeatable jobs if needed during dev
  const repeatables = await scraperQueue.getRepeatableJobs();
  for (const job of repeatables) {
    await scraperQueue.removeRepeatableByKey(job.key);
  }

  await scheduleJobs();
}

start();
