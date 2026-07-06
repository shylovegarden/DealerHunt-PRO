import { Queue } from "bullmq";

const redisUrl =
  process.env.UPSTASH_REDIS_URL ||
  process.env.REDIS_URL ||
  "redis://localhost:6379";

const connection = {
  url: redisUrl,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
} as any;

export const maintenanceQueue = new Queue("maintenance", { connection });
