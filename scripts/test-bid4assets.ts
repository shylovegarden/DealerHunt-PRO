import { scrapeBid4Assets } from "../lib/housing/sources/bid4assets";

async function run() {
  console.log("Testing Bid4Assets scraper...");
  const results = await scrapeBid4Assets(200);
  console.log(`Total Bid4Assets properties fetched: ${results.length}`);
  if (results.length > 0) {
    console.log("Sample:", JSON.stringify(results[0], null, 2));
  }
}
run().catch(console.error);
