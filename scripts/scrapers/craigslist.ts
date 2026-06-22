import axios from "axios";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

const CITIES = ["dallas", "austin", "houston", "losangeles", "atlanta"];

/**
 * Craigslist Scraper
 * Cycles through major cities grabbing "By Owner" auto listings.
 */
export async function scrapeCraigslist() {
  console.log("[CL-BOT] Starting Craigslist Scraping Run...");

  for (const city of CITIES) {
    try {
      console.log(`[CL-BOT] Scraping city: ${city}...`);

      // Search: cars & trucks - by owner (cto), sorted by newest
      const url = `https://${city}.craigslist.org/search/cto`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(response.data);
      const vehicles: any[] = [];

      $(".cl-search-result").each((_, el) => {
        const title = $(el).find(".title").text().trim();
        const priceText = $(el)
          .find(".price")
          .text()
          .trim()
          .replace("$", "")
          .replace(",", "");
        const link = $(el).find("a.cl-app-anchor").attr("href") || "";

        // Basic parsing (Craigslist is messy, we rely heavily on mcp.vin later)
        // If title is "2015 Ford F-150 Lariat", split it
        const parts = title.split(" ");
        const year = parseInt(parts[0]);
        const make = parts[1] || "Unknown";
        const model = parts.slice(2).join(" ") || "Unknown";

        // Fake VIN for testing since CL doesn't list it on the search page (requires deep crawl)
        const fakeVin = `CL${city.toUpperCase()}${Math.floor(Math.random() * 10000000)}`;

        if (year > 1990 && !isNaN(year)) {
          vehicles.push({
            source: "craigslist",
            source_deal_id: fakeVin,
            source_url: link.startsWith("http")
              ? link
              : `https://${city}.craigslist.org${link}`,
            title: title || `${year} ${make} ${model}`,
            vin: fakeVin,
            year,
            make: make || "Unknown",
            model: model || "Unknown",
            ask_price: Math.round(parseFloat(priceText)) || 5000,
            condition: "clean_title", // matches listing_condition enum
            location_city: city,
            location_state: "TX", // Simplified for demo
          });
        }
      });

      console.log(
        `[CL-BOT] Found ${vehicles.length} listings in ${city}. Pushing...`,
      );

      for (const vehicle of vehicles) {
        const { error } = await supabase
          .from("deals")
          .upsert(vehicle, { onConflict: "source,source_deal_id" });

        if (error) console.error(`[CL-BOT] Error:`, error.message);
      }

      // Delay to avoid IP ban
      await new Promise((r) => setTimeout(r, 2000));
    } catch (error: any) {
      console.error(`[CL-BOT] Error scraping ${city}:`, error.message);
    }
  }

  console.log("[CL-BOT] Run complete.");
}

if (require.main === module) {
  scrapeCraigslist();
}
