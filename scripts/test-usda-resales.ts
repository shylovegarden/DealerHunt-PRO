import { scrapeUsdaResales } from "../lib/housing/sources/usda-resales";

async function run() {
  console.log("Testing USDA Resales scraper...");
  const results = await scrapeUsdaResales(200);
  console.log(`Total USDA resale properties fetched: ${results.length}`);
  if (results.length > 0) {
    console.log("Sample:", JSON.stringify(results[0], null, 2));
  }
}
run().catch(console.error);
