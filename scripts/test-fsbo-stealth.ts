import { smartFetch } from "../lib/scrapers/smart-fetch";
import * as cheerio from "cheerio";
import fs from "fs";

async function run() {
  // FSBO.com uses client-side rendering, so we need stealth mode to get rendered content
  const url =
    "https://fsbo.com/search?q=Dallas%2C+TX&propertyType=SINGLE_FAMILY";
  console.log(`Fetching with stealth tier...`);
  // Force stealth tier by looking for listing data
  const { html, blocked, tier } = await smartFetch(url, {
    validate: (h) =>
      h.includes("listing") || h.includes("price") || h.includes("bedroom"),
  });
  console.log(`Tier: ${tier}, blocked: ${blocked}`);
  fs.writeFileSync("fsbo-stealth.html", html);
  console.log("Saved fsbo-stealth.html, length:", html.length);

  const $ = cheerio.load(html);
  // Look for card elements
  const cards: string[] = [];
  $("[class*='card'], [class*='listing'], article, [data-testid]").each(
    (_, el) => {
      cards.push($(el).text().substring(0, 100));
    },
  );
  console.log(`Found ${cards.length} candidate card elements`);
  if (cards.length > 0) console.log("Sample:", cards.slice(0, 3));
}
run().catch(console.error);
