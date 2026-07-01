import { scrapeHubzu } from "../lib/housing/sources/hubzu";

async function run() {
  const results = await scrapeHubzu(200);
  console.log(`Total: ${results.length}`);
  const sample = results.find((r) => r.state === "TX");
  console.log("TX sample:", JSON.stringify(sample, null, 2));
}
run().catch(console.error);
