#!/usr/bin/env tsx
// scripts/test-all-sources.ts
// Test all enabled scrapers to see which ones work

import { runScrapers } from "../lib/scrapers/runner";

async function testAllSources() {
  console.log("🚀 Testing ALL enabled scrapers...\n");

  try {
    const results = await runScrapers({
      orchestrator: "concurrent",
      concurrency: 3,
    });

    console.log("\n📊 RESULTS SUMMARY:");
    console.log("==================");

    const sorted = results.sort((a, b) => (b.dealsFound || 0) - (a.dealsFound || 0));

    for (const result of sorted) {
      const status = result.success ? "✅" : "❌";
      const deals = result.dealsFound > 0 ? `${result.dealsFound} deals` : "0 deals";
      const time = result.duration ? `${(result.duration / 1000).toFixed(1)}s` : "N/A";

      console.log(`${status} ${(result.source + "                    ").slice(0, 20)} ${(deals + "    ").slice(0, 10)} ${time}`);

      if (result.error) {
        console.log(`   └─ Error: ${result.error.substring(0, 80)}...`);
      }
    }

    const working = results.filter((r) => r.success && r.dealsFound > 0);
    const failed = results.filter((r) => !r.success);
    const noDeals = results.filter((r) => r.success && r.dealsFound === 0);

    console.log(`\n📈 SUMMARY:`);
    console.log(`✅ Working sources: ${working.length}`);
    console.log(`❌ Failed sources: ${failed.length}`);
    console.log(`⚪ No deals found: ${noDeals.length}`);
    console.log(`📊 Total deals scraped: ${results.reduce((sum, r) => sum + (r.dealsFound || 0), 0)}`);
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testAllSources().catch(console.error);
