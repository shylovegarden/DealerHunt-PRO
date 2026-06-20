import Queue from 'bull';
import { chromium } from 'playwright';
import { extractVehicleDataFromText } from './agents/scraper-agent';
import { predictVehicleValuation } from './agents/valuation-agent';
import { createServerComponentClient } from '../supabase';

// Initialize the queues
export const aiParsingQueue = new Queue('ai-parsing', process.env.REDIS_URL || 'redis://127.0.0.1:6379');
export const aiValuationQueue = new Queue('ai-valuation', process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// --- 1. PARSING QUEUE ---
aiParsingQueue.process(async (job) => {
  const { sourceUrl, dealerId, source } = job.data;
  console.log(`[AI Worker] Scraping VDP: ${sourceUrl}`);
  
  let browser;
  let rawText = '';
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    rawText = await page.evaluate(() => document.body.innerText);
    
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src.startsWith('http'));
    });
    rawText += `\n\nImage URLs on page:\n${images.join('\n')}`;
    
  } catch (error) {
    console.error(`[AI Worker] Playwright failed on ${sourceUrl}:`, error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }

  console.log(`[AI Worker] Extracted ${rawText.length} characters. Sending to Gemini...`);
  
  const extractedData = await extractVehicleDataFromText(rawText);
  if (!extractedData || !extractedData.make) {
    throw new Error('Failed to extract data using AI');
  }
  
  const sourceDealId = new URL(sourceUrl).pathname.replace(/[^a-zA-Z0-9]/g, '') || Date.now().toString();
  const dbSource = source || 'independent_dealer';

  // Hand off to the valuation queue instead of saving immediately
  // This allows parsing to be fast and valuation to be retried independently
  await aiValuationQueue.add({
    dealData: extractedData,
    sourceDealId,
    source: dbSource,
    sourceUrl,
    dealerId
  });

  return extractedData;
});

// --- 2. VALUATION QUEUE ---
aiValuationQueue.process(async (job) => {
  const { dealData, sourceDealId, source, sourceUrl, dealerId } = job.data;
  console.log(`[AI Valuation] Valuing ${dealData.year} ${dealData.make} ${dealData.model}`);

  const valuation = await predictVehicleValuation({
    make: dealData.make,
    model: dealData.model,
    year: dealData.year,
    mileage: dealData.mileage || 0,
    condition: dealData.condition,
    ask_price: dealData.ask_price,
    location_state: 'Unknown' // Ideally passed down from dealer info
  });

  console.log(`[AI Valuation] Wholesale: $${valuation.estimatedWholesalePrice}, Retail: $${valuation.estimatedRetailPrice}`);

  // Mock transport cost calculation ($0.78 * random miles between 100-1500)
  const estimatedTransportMiles = Math.floor(Math.random() * 1400) + 100;
  const estimatedTransportCost = Math.floor(estimatedTransportMiles * 0.78);
  const estimatedRepairCost = valuation.estimatedRepairCost || 0;

  // Calculate true net profit
  const trueNetProfit = valuation.estimatedWholesalePrice - dealData.ask_price - estimatedTransportCost - estimatedRepairCost;

  // Calculate true profit score (0-100) based on true margin
  let profitScore = 0;
  if (trueNetProfit > 0) {
     profitScore = Math.min(100, Math.floor((trueNetProfit / dealData.ask_price) * 100));
  }

  const supabase = createServerComponentClient();
  
  const dealRecord = {
    source,
    dealer_id: dealerId || null,
    source_deal_id: sourceDealId,
    source_url: sourceUrl,
    title: dealData.title,
    make: dealData.make,
    model: dealData.model,
    year: dealData.year,
    ask_price: dealData.ask_price,
    mileage: dealData.mileage || null,
    vin: dealData.vin || null,
    condition: dealData.condition,
    damage_type: dealData.damage_type || null,
    color: dealData.color || null,
    body_style: dealData.body_style || null,
    fuel_type: dealData.fuel_type || null,
    transmission: dealData.transmission || null,
    drivetrain: dealData.drivetrain || null,
    engine: dealData.engine || null,
    images: dealData.images || [],
    mmr_value: valuation.estimatedWholesalePrice, // This automatically triggers profit_estimate generation via DB trigger/generated column
    profit_score: profitScore,
    ai_wholesale_estimate: valuation.estimatedWholesalePrice,
    ai_retail_estimate: valuation.estimatedRetailPrice,
    ai_rationale: valuation.rationale,
    is_arbitrage_opportunity: valuation.isArbitrageOpportunity,
    estimated_transport_cost: estimatedTransportCost,
    estimated_repair_cost: estimatedRepairCost,
    true_net_profit: trueNetProfit,
    active: true,
    last_seen_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('deals')
    .upsert(dealRecord, { onConflict: 'source, source_deal_id' });

  if (error) {
    console.error(`[AI Valuation] Database error:`, error);
    throw new Error(`Database error: ${error.message}`);
  }

  console.log(`[AI Valuation] Successfully upserted deal into database.`);
  return { dealData, valuation };
});

// Helper function to add VDP URLs to the queue
export async function queueForAIParsing(sourceUrl: string, dealerId?: string, source?: string) {
  return aiParsingQueue.add({ sourceUrl, dealerId, source }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  });
}
