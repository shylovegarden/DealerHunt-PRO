import { runConcurrent } from "../lib/scrapers/runner";
import * as dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const args = process.argv.slice(2);
  const source = args[0] || "craigslist"; // default to craigslist if none provided

  console.log(`🚀 Starting manual test scrape for source: ${source}`);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. Data may not insert into Supabase.",
    );
  }

  try {
    const results = await runConcurrent([source], 1);

    console.log("\n✅ Scrape Complete!");
    console.log("Results:");
    console.table(results);
  } catch (error) {
    console.error("\n❌ Scrape Failed:", error);
  }
}

main();
