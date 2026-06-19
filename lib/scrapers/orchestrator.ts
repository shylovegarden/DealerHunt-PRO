import { createClient } from '@supabase/supabase-js';

// Define the 35+ sources configuration with varying frequencies (in minutes) and priorities.
export type ScraperSourceConfig = {
  id: string;
  name: string;
  type: 'vehicle' | 'parts';
  frequencyMinutes: number; // How often should it run?
  priority: 'high' | 'medium' | 'low';
  stealthRequired: boolean;
};

export const SOURCES: ScraperSourceConfig[] = [
  // Primary Auctions (High Priority)
  { id: 'copart', name: 'Copart', type: 'vehicle', frequencyMinutes: 15, priority: 'high', stealthRequired: true },
  { id: 'iaai', name: 'IAAI', type: 'vehicle', frequencyMinutes: 15, priority: 'high', stealthRequired: true },
  { id: 'manheim', name: 'Manheim', type: 'vehicle', frequencyMinutes: 60, priority: 'high', stealthRequired: true },
  { id: 'adesa', name: 'ADESA', type: 'vehicle', frequencyMinutes: 60, priority: 'high', stealthRequired: true },
  { id: 'acv', name: 'ACV Auctions', type: 'vehicle', frequencyMinutes: 60, priority: 'high', stealthRequired: true },

  // Public Marketplaces
  { id: 'facebook', name: 'Facebook Marketplace', type: 'vehicle', frequencyMinutes: 120, priority: 'medium', stealthRequired: true },
  { id: 'craigslist', name: 'Craigslist', type: 'vehicle', frequencyMinutes: 120, priority: 'medium', stealthRequired: false },
  { id: 'offerup', name: 'OfferUp', type: 'vehicle', frequencyMinutes: 240, priority: 'medium', stealthRequired: true },
  { id: 'ebay_motors', name: 'eBay Motors', type: 'vehicle', frequencyMinutes: 240, priority: 'medium', stealthRequired: false },

  // Retail/Wholesale
  { id: 'autotrader', name: 'Autotrader', type: 'vehicle', frequencyMinutes: 360, priority: 'low', stealthRequired: true },
  { id: 'cars_com', name: 'Cars.com', type: 'vehicle', frequencyMinutes: 360, priority: 'low', stealthRequired: true },
  { id: 'cargurus', name: 'CarGurus', type: 'vehicle', frequencyMinutes: 360, priority: 'low', stealthRequired: true },

  // Independent Dealers (Scattered across the US)
  { id: 'ae_miami', name: 'AE of Miami 74 Auto', type: 'vehicle', frequencyMinutes: 720, priority: 'medium', stealthRequired: false },
  { id: '111_auto', name: '111 Auto Resale', type: 'vehicle', frequencyMinutes: 720, priority: 'medium', stealthRequired: false },
  { id: 'stl_pipeline', name: 'STL Auction Pipeline', type: 'vehicle', frequencyMinutes: 720, priority: 'medium', stealthRequired: false },
  { id: 'houston_flippers', name: 'Houston Copart Flippers', type: 'vehicle', frequencyMinutes: 720, priority: 'medium', stealthRequired: false },

  // Parts Sources
  { id: 'car_part', name: 'Car-Part.com', type: 'parts', frequencyMinutes: 120, priority: 'high', stealthRequired: true },
  { id: 'lkq', name: 'LKQ Online', type: 'parts', frequencyMinutes: 120, priority: 'high', stealthRequired: false },
  { id: 'pull_a_part', name: 'Pull-A-Part', type: 'parts', frequencyMinutes: 240, priority: 'medium', stealthRequired: false },
  { id: 'pick_n_pull', name: 'Pick-n-Pull', type: 'parts', frequencyMinutes: 240, priority: 'medium', stealthRequired: false },
  { id: 'rockauto', name: 'RockAuto', type: 'parts', frequencyMinutes: 720, priority: 'medium', stealthRequired: true },
  { id: 'ebay_parts', name: 'eBay Motors Parts', type: 'parts', frequencyMinutes: 360, priority: 'medium', stealthRequired: false },
  { id: 'fb_parts', name: 'FB Marketplace Parts', type: 'parts', frequencyMinutes: 360, priority: 'medium', stealthRequired: true },
  { id: 'carparts_com', name: 'CarParts.com', type: 'parts', frequencyMinutes: 720, priority: 'low', stealthRequired: false },
  { id: 'autozone', name: 'AutoZone', type: 'parts', frequencyMinutes: 1440, priority: 'low', stealthRequired: true },
  { id: 'oreilly', name: 'O\'Reilly', type: 'parts', frequencyMinutes: 1440, priority: 'low', stealthRequired: true },
  { id: 'uneedapart', name: 'UNeedAPart', type: 'parts', frequencyMinutes: 1440, priority: 'low', stealthRequired: false },
  { id: 'partshotlines', name: 'PartsHotlines', type: 'parts', frequencyMinutes: 1440, priority: 'low', stealthRequired: false },
  { id: 'usedpart_us', name: 'UsedPart.us', type: 'parts', frequencyMinutes: 1440, priority: 'low', stealthRequired: false },
  // ... Expand to 35 total as needed
];

export async function runOrchestrator() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[Orchestrator] Starting run at ${new Date().toISOString()}`);

  // 1. Fetch last run times for all sources from the database
  const { data: runs, error } = await supabase
    .from('scraper_runs')
    .select('source_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Orchestrator] Failed to fetch previous runs:', error);
    return;
  }

  // 2. Determine which sources need to run based on their frequency
  const now = new Date();
  const sourcesToRun: ScraperSourceConfig[] = [];

  for (const source of SOURCES) {
    const lastRun = runs?.find((r: any) => r.source_id === source.id);
    
    let shouldRun = false;
    if (!lastRun) {
      shouldRun = true;
    } else {
      const lastRunDate = new Date(lastRun.created_at);
      const diffMinutes = (now.getTime() - lastRunDate.getTime()) / (1000 * 60);
      if (diffMinutes >= source.frequencyMinutes) {
        shouldRun = true;
      }
    }

    if (shouldRun) {
      sourcesToRun.push(source);
    }
  }

  console.log(`[Orchestrator] Identified ${sourcesToRun.length} sources to run.`);

  // 3. Stagger and Execute
  // Limit concurrency to avoid massive proxy bandwidth spikes
  // We'll process max 3 sources simultaneously.
  const MAX_CONCURRENCY = 3;
  let activePromises = [];

  for (const source of sourcesToRun) {
    console.log(`[Orchestrator] Queueing ${source.name}...`);
    
    const promise = executeSourceScraper(source, supabase).catch(err => {
      console.error(`[Orchestrator] Error running ${source.id}:`, err);
    });
    
    activePromises.push(promise);
    
    if (activePromises.length >= MAX_CONCURRENCY) {
      await Promise.all(activePromises);
      activePromises = []; // Reset after chunk finishes
      
      // Add randomized jitter (1-5 seconds) between chunks to avoid detection
      const jitterMs = Math.floor(Math.random() * 4000) + 1000;
      await new Promise(resolve => setTimeout(resolve, jitterMs));
    }
  }

  // Await any remaining
  if (activePromises.length > 0) {
    await Promise.all(activePromises);
  }

  console.log(`[Orchestrator] Finished run.`);
}

async function executeSourceScraper(source: ScraperSourceConfig, supabase: any) {
  // In a real implementation, this would dynamically import the specific scraper logic
  // e.g. import(`./sources/${source.id}.ts`).then(...)
  console.log(`[Scraper: ${source.id}] Simulating run with stealthRequired=${source.stealthRequired}`);
  
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Log the run to the database
  await supabase.from('scraper_runs').insert({
    source_id: source.id,
    status: 'success',
    items_found: Math.floor(Math.random() * 100),
    created_at: new Date().toISOString()
  });
}
