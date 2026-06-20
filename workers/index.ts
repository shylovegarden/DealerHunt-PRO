import { Worker, Queue } from 'bullmq';
import { scrapeIAA } from '../lib/scrapers/sources/iaa';
import { scrapeCraigslist } from '../lib/scrapers/sources/craigslist';
import { scrapeCopart } from '../lib/scrapers/sources/copart';
// Stubbing Ebay for now since we didn't implement it in this sprint
const scrapeEbay = async () => { console.log('Ebay scrape stub'); return 0; };
import { checkAlerts } from '../lib/alerts/alert-engine';

const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379'

const connection = {
  url: redisUrl,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
} as any;

export const scrapeQueue = new Queue('scrape', { connection });

// Schedule recurring jobs
async function scheduleJobs() {
  await scrapeQueue.add('iaa',         {}, { repeat: { pattern: '*/30 * * * *' }, attempts: 3, backoff: { type: 'exponential', delay: 30000 }});
  await scrapeQueue.add('craigslist',  {}, { repeat: { pattern: '0 * * * *' },    attempts: 3, backoff: { type: 'exponential', delay: 30000 }});
  await scrapeQueue.add('copart',      {}, { repeat: { pattern: '*/5 8-18 * * 1-5' }, attempts: 3, backoff: { type: 'exponential', delay: 60000 }});
  await scrapeQueue.add('ebay',        {}, { repeat: { pattern: '*/15 * * * *' }, attempts: 3 });
  await scrapeQueue.add('alert-check', {}, { repeat: { pattern: '*/5 * * * *' },  attempts: 3 });
  
  console.log('[Queue] Jobs scheduled');
}

// Worker — processes jobs
const worker = new Worker('scrape', async (job) => {
  console.log(`[Worker] Processing job: ${job.name}`);
  
  const startTime = Date.now();
  let found = 0;
  
  try {
    switch (job.name) {
      case 'iaa':        found = await scrapeIAA(); break;
      case 'craigslist': found = await scrapeCraigslist(); break;
      case 'copart':     found = await scrapeCopart(); break;
      case 'ebay':       found = await scrapeEbay(); break;
      case 'alert-check': await checkAlerts(); return;
      default:
        console.warn(`[Worker] Unknown job: ${job.name}`);
    }
    
    // Log job to Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co', 
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key'
    );
    await supabase.from('scrape_jobs').insert({
      source: job.name,
      status: 'done',
      listings_found: found,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });
    
    console.log(`[Worker] ${job.name} done: ${found} listings in ${Date.now() - startTime}ms`);
    
  } catch (error) {
    console.error(`[Worker] ${job.name} failed:`, error);
    throw error; // BullMQ will retry
  }
  
}, {
  connection,
  concurrency: 3, // Run 3 jobs at once max
  limiter: { max: 10, duration: 1000 }, // Max 10 jobs/sec
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.name} failed after retries:`, err.message);
});

// Start
scheduleJobs().then(() => {
  console.log('[DealerHunt Worker] Running. Press Ctrl+C to stop.');
});
