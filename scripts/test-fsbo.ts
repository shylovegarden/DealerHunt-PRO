import { scrapeFsboQuery } from "../lib/housing/sources/fsbo";

async function run() {
  console.log("Testing FSBO query for Dallas, TX...");
  const results = await scrapeFsboQuery("Dallas, TX", "SINGLE_FAMILY");
  console.log(`Fetched ${results.length} properties`);
  const sample = results[0];
  if (sample) {
    console.log("Sample:", JSON.stringify(sample, null, 2));
  }
}
run().catch(console.error);
