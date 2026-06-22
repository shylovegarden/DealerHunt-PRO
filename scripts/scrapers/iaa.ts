import axios from "axios";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables for local testing
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "", // Using service role to bypass RLS in worker
);

/**
 * IAA Scraper (Headless Engine)
 * Note: In production, we route through FlareSolverr to bypass captchas.
 * For this initial build, we parse standard HTML.
 */
export async function scrapeIAA() {
  console.log("[IAA-BOT] Starting IAA Scraping Run...");

  // In a real scenario, this would be a search URL like:
  // https://www.iaai.com/Search?url=xxxx
  // We mock a standard HTML fetch structure to show how Cheerio integrates.
  try {
    // Faked for demonstration since IAA requires heavy anti-bot bypass.
    // Replace with real FlareSolverr Axios call when deployed.
    const mockHtml = `
      <div class="table-row">
        <div class="vin">1G11234567890VIN</div>
        <div class="title">2018 Chevrolet Silverado 1500</div>
        <div class="bid">$4500</div>
        <div class="condition">Run and Drive</div>
        <div class="location">Dallas, TX</div>
      </div>
      <div class="table-row">
        <div class="vin">JTEBU5JR0H5000VIN</div>
        <div class="title">2017 Toyota Tacoma</div>
        <div class="bid">$6200</div>
        <div class="condition">Start Code</div>
        <div class="location">Austin, TX</div>
      </div>
    `;

    const $ = cheerio.load(mockHtml);
    const vehicles: any[] = [];

    $(".table-row").each((_, el) => {
      const vin = $(el).find(".vin").text().trim();
      const title = $(el).find(".title").text().trim(); // e.g. "2018 Chevrolet Silverado"
      const bidText = $(el).find(".bid").text().trim().replace("$", "");
      const condition = $(el).find(".condition").text().trim();
      const location = $(el).find(".location").text().trim();

      // Basic parse
      const [yearStr, make, ...modelArr] = title.split(" ");
      const [city, state] = location.split(", ");

      const yearVal = parseInt(yearStr);
      const makeVal = make || "Unknown";
      const modelVal = modelArr.join(" ") || "Unknown";
      const finalTitle = `${yearVal} ${makeVal} ${modelVal}`;

      // Map condition string to valid enum listing_condition
      let cleanCondition = "clean_title";
      if (condition.toLowerCase().includes("run")) {
        cleanCondition = "run_drive";
      } else if (
        condition.toLowerCase().includes("start") ||
        condition.toLowerCase().includes("repair")
      ) {
        cleanCondition = "repairable";
      }

      vehicles.push({
        source: "iaa",
        source_deal_id: vin,
        source_url: `https://www.iaai.com/VehicleDetail/${vin}`,
        title: finalTitle,
        vin,
        year: yearVal,
        make: makeVal,
        model: modelVal,
        ask_price: Math.round(parseFloat(bidText)) || 4500,
        condition: cleanCondition,
        location_city: city,
        location_state: state || "TX",
      });
    });

    console.log(
      `[IAA-BOT] Found ${vehicles.length} listings. Pushing to Supabase...`,
    );

    // Upsert to Supabase (match on source + source_deal_id to avoid duplicates)
    for (const vehicle of vehicles) {
      const { error } = await supabase
        .from("deals")
        .upsert(vehicle, { onConflict: "source,source_deal_id" });

      if (error) {
        console.error(
          `[IAA-BOT] Error saving VIN ${vehicle.vin}:`,
          error.message,
        );
      } else {
        console.log(
          `[IAA-BOT] Saved ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.ask_price}`,
        );
      }
    }

    console.log("[IAA-BOT] Run complete.");
  } catch (error: any) {
    console.error("[IAA-BOT] Fatal error during scraping:", error.message);
  }
}

// Allow running directly
if (require.main === module) {
  scrapeIAA();
}
