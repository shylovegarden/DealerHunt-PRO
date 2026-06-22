import { createPatchrightBrowser } from "../tools/patchright-engine";
import { enrichAndStore } from "../sources/shared";
import * as dotenv from "dotenv";
import * as path from "path";

// Load local environment variables for Supabase
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function runEndToEndBrowserAutomation() {
  console.log("🚗 Starting End-to-End Browser Automation with Patchright...");

  // 1. Launch the stealth Chromium browser VISIBLY (headless: false)
  const { browser, page } = await createPatchrightBrowser({ headless: false });

  try {
    const targetCity = "dallas";
    const searchTerm = "F-150";
    const url = `https://${targetCity}.craigslist.org/search/cto?query=${encodeURIComponent(searchTerm)}&sort=rel`;

    console.log(`[Browser] Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // 2. Wait for the page to render the search results
    console.log("[Browser] Waiting for listings to render in the DOM...");
    await page.waitForSelector("li.cl-static-search-result, .result-row", {
      state: "attached",
      timeout: 15000,
    });

    // 3. Extract the data directly from the browser DOM
    console.log("[Browser] Extracting live vehicle data...");
    const extractedVehicles = await page.$$eval(
      "li.cl-static-search-result, .result-row",
      (elements, city) => {
        return elements.map((el) => {
          const titleEl = el.querySelector(
            ".cl-app-anchor, .result-title, .titlestring",
          );
          const priceEl = el.querySelector(".priceinfo, .result-price");
          const linkEl = el.querySelector("a");

          const title = titleEl?.textContent?.trim() || "Unknown Title";
          const priceText = priceEl?.textContent?.replace(/[^0-9]/g, "") || "0";
          const price = parseInt(priceText, 10);
          const href = linkEl?.getAttribute("href") || "";
          const id =
            el.getAttribute("data-pid") || String(Date.now() + Math.random());

          return {
            id,
            title,
            price,
            url: href.startsWith("http")
              ? href
              : `https://${city}.craigslist.org${href}`,
          };
        }); // Removed the strict price filter for the test
      },
      targetCity,
    );

    console.log(
      `[Browser] Extracted ${extractedVehicles.length} vehicles from the page.`,
    );

    // 4. Transform and enrich the data, then store it in Supabase
    console.log("[Database] Pushing records to Supabase...");
    let inserted = 0;

    for (const v of extractedVehicles.slice(0, 5)) {
      // Limit to 5 for the demo
      const vehicleRecord = {
        source: "craigslist",
        source_category: "private",
        external_id: v.id,
        title: v.title,
        make: "Ford",
        model: "F-150",
        asking_price: v.price,
        current_bid: v.price,
        location_city: targetCity,
        location_state: "TX",
        listing_url: v.url,
        images: [],
      };

      try {
        await enrichAndStore(vehicleRecord);
        inserted++;
        console.log(
          `  ✅ Stored: $${v.price.toLocaleString()} - ${v.title.substring(0, 40)}...`,
        );
      } catch (e) {
        console.error(`  ❌ Failed to store: ${v.title}`, e);
      }
    }

    console.log(
      `\n🎉 End-to-End Test Complete! Successfully scraped and saved ${inserted} live listings using Playwright automation.`,
    );

    // Keep browser open for 5 seconds so you can see it before it closes!
    console.log(
      "[Browser] Waiting 5 seconds before closing so you can see the result...",
    );
    await page.waitForTimeout(5000);
  } catch (error) {
    console.error("Automation failed:", error);
  } finally {
    await browser.close();
  }
}

runEndToEndBrowserAutomation().then(() => process.exit(0));
