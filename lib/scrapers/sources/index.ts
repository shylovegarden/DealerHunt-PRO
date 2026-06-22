// lib/scrapers/sources/index.ts
// ─── Per-source scraper implementations ──────────────────────────────────────

import type { Deal } from "@/types";
import {
  fetchBrowser,
  fetchHtml,
  paginate,
  extractPrice,
  extractMileage,
  extractYear,
  normalizeUrl,
  type ScraperConfig,
} from "../engine";
import { upsertDeals } from "../pipeline";
import { CRAIGSLIST_SITES, US_STATES } from "@/lib/geo";
import pLimit from "p-limit";

// ── Detail-page enrichment ───────────────────────────────────────────────────
// Listing CARDS lack VIN / true mileage / title status — those live on each detail page.
// We fetch a bounded number of detail pages (static HTML, $0) to pull the real data the
// valuation/dedupe/recall engines need. Tunable: CL_ENRICH (default on), CL_ENRICH_MAX,
// CL_ENRICH_CONCURRENCY.

// Craigslist "title status" → listing_condition enum.
function mapCraigslistTitle(status?: string): string | undefined {
  const s = (status || "").toLowerCase();
  if (!s) return undefined;
  if (s.includes("clean")) return "clean_title";
  if (s.includes("salvage")) return "salvage_title";
  if (s.includes("rebuilt") || s.includes("rebuild")) return "rebuilt_title";
  if (s.includes("parts")) return "parts_only";
  return undefined; // lien/missing/etc → leave as-is
}

async function enrichCraigslistDetail(url: string): Promise<Partial<Deal>> {
  try {
    const axios = (await import("axios")).default;
    const cheerio = await import("cheerio");
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html",
      },
      timeout: 12000,
    });
    const $ = cheerio.load(res.data);
    const out: Partial<Deal> = {};

    const attr = (cls: string) =>
      $(`.attr.${cls} .valu, .attr.${cls} a`).first().text().trim();

    // VIN — dedicated attr, else scan the attribute group text for a 17-char VIN.
    let vin = attr("auto_vin");
    if (!vin || vin.length !== 17) {
      const m = $(".attrgroup")
        .text()
        .match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
      if (m) vin = m[1];
    }
    if (vin && vin.length === 17) out.vin = vin.toUpperCase();

    // Odometer / true mileage.
    const odo = attr("auto_miles") || attr("odometer");
    const miles = parseInt(odo.replace(/[^0-9]/g, ""));
    if (miles > 0 && miles < 400000) out.mileage = miles;

    // Title status → real condition.
    const cond = mapCraigslistTitle(attr("auto_title_status"));
    if (cond) out.condition = cond as any;

    // Better/more images from the detail gallery.
    const imgs = $('.gallery img, .slide img, img[src*="images.craigslist"]')
      .map((_, e) => $(e).attr("src"))
      .get()
      .filter(Boolean) as string[];
    if (imgs.length) out.images = Array.from(new Set(imgs)).slice(0, 12);

    return out;
  } catch {
    return {};
  }
}

async function enrichDeals(deals: Partial<Deal>[]): Promise<void> {
  if (process.env.CL_ENRICH === "false") return;
  const max = parseInt(process.env.CL_ENRICH_MAX || "60");
  const concurrency = parseInt(process.env.CL_ENRICH_CONCURRENCY || "4");
  // Enrich listings that still lack a VIN, up to the cap.
  const targets = deals
    .filter((d) => d.source_url && (!d.vin || d.vin.length !== 17))
    .slice(0, max);
  if (!targets.length) return;
  const limit = pLimit(concurrency);
  let enriched = 0;
  await Promise.all(
    targets.map((d) =>
      limit(async () => {
        const extra = await enrichCraigslistDetail(d.source_url as string);
        if (Object.keys(extra).length) {
          Object.assign(d, extra);
          enriched++;
        }
      }),
    ),
  );
  console.log(
    `[Craigslist] Enriched ${enriched}/${targets.length} detail pages (VIN/mileage/title)`,
  );
}

// ════════════════════════════════════════════════════════════
//  COPART — salvage auction
// ════════════════════════════════════════════════════════════
export const COPART_CONFIG: ScraperConfig = {
  name: "Copart",
  baseUrl: "https://www.copart.com",
  renderMode: "browser",
  requestDelay: 3000,
  concurrency: 2,
  useProxies: true,
  stealth: true,
  maxPages: 50,
  headers: { "Accept-Language": "en-US,en;q=0.9" },
};

export async function scrapeCopart(
  searchTerms: string[] = [],
  states: string[] = [],
) {
  console.log("[Copart] Starting scrape...");
  const allDeals: Partial<Deal>[] = [];

  for (const state of states.length ? states : [...US_STATES]) {
    const gen = paginate<Partial<Deal>>(
      COPART_CONFIG,
      (page) =>
        `https://www.copart.com/lotSearchResults/?free=true&query=${encodeURIComponent(state)}&page=${page}&size=100`,
      async (html) => {
        const cheerio = await import("cheerio");
        const $ = cheerio.load(typeof html === "string" ? html : "");
        const items: Partial<Deal>[] = [];

        // Copart renders a table — each row is a lot
        $('tr[ng-repeat], .lot-row, [data-uname="lotRow"]').each((_, el) => {
          const row = $(el);
          const title = row
            .find('[data-uname="lotsearchLotTitle"], .lot-title')
            .text()
            .trim();
          const priceText = row
            .find('[data-uname="bidValue"], .buy-now-price')
            .text()
            .trim();
          const mileText = row.find('[data-uname="odometer"]').text().trim();
          const lotUrl = row.find('a[href*="/lot/"]').attr("href");
          const imgSrc = row.find("img").attr("src");
          const locationText = row
            .find('[data-uname="lotLocation"]')
            .text()
            .trim();
          const damageText = row
            .find('[data-uname="primaryDamage"]')
            .text()
            .trim();

          if (!title || !priceText) return;

          items.push({
            source: "copart",
            source_deal_id: lotUrl?.split("/lot/")[1]?.split("?")[0] || "",
            source_url: lotUrl
              ? normalizeUrl(lotUrl, COPART_CONFIG.baseUrl)
              : "",
            title,
            year: extractYear(title),
            make: title.split(" ")[1] || "",
            model: title.split(" ").slice(2, 4).join(" ") || "",
            ask_price: extractPrice(priceText) || 0,
            mileage: extractMileage(mileText),
            condition: "repairable",
            damage_type: damageText,
            location_state: state,
            location_city: locationText.split(",")[0]?.trim(),
            images: imgSrc ? [imgSrc] : [],
          });
        });

        const hasMore =
          $('[aria-label="Next page"], .next-btn:not(.disabled)').length > 0;
        return { items, hasMore };
      },
    );

    for await (const batch of gen) {
      allDeals.push(...batch);
    }
  }

  console.log(`[Copart] Found ${allDeals.length} deals`);
  await upsertDeals(allDeals);
  return allDeals.length;
}

// ════════════════════════════════════════════════════════════
//  CRAIGSLIST — covers all US cities
// ════════════════════════════════════════════════════════════
// Nationwide Craigslist coverage. Defaults to all 50-state metro subdomains (lib/geo.ts).
// Override with CL_CITIES env (comma-separated subdomains); cap per-run with CL_MAX_CITIES.
const CL_SITE_STATE = new Map(CRAIGSLIST_SITES.map((s) => [s.site, s.state]));
const CL_CITIES: string[] = (() => {
  const fromEnv = process.env.CL_CITIES?.split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  let all = fromEnv?.length ? fromEnv : CRAIGSLIST_SITES.map((s) => s.site);
  // Rotating shards for frequent near-real-time runs: CL_SHARDS=N total, CL_SHARD=k this run.
  const shards = parseInt(process.env.CL_SHARDS || "0");
  const shard = parseInt(process.env.CL_SHARD || "0");
  if (shards > 1)
    all = all.filter(
      (_, i) => i % shards === ((shard % shards) + shards) % shards,
    );
  const cap = parseInt(process.env.CL_MAX_CITIES || "0");
  return cap > 0 ? all.slice(0, cap) : all;
})();

export const CL_CONFIG: ScraperConfig = {
  name: "Craigslist",
  baseUrl: "https://craigslist.org",
  renderMode: "static", // CL is static HTML — fast!
  requestDelay: 1500,
  concurrency: 5,
  useProxies: false, // CL rarely blocks
  stealth: false,
  maxPages: 10,
};

// Craigslist channels: by-owner = private/wholesale supply, by-dealer = retail comps.
// Scanning both gives a real $0 retail-vs-private spread (the arbitrage signal).
const CL_CHANNELS: { path: string; source: string }[] = [
  { path: "cto", source: "craigslist" }, // cars+trucks by owner
  { path: "ctd", source: "craigslist_dealer" }, // cars+trucks by dealer (retail)
];

export async function scrapeCraigslist(
  query = "cars+trucks",
  minPrice = 500,
  maxPrice = 35000,
) {
  console.log(
    `[Craigslist] Scanning ${CL_CITIES.length} cities × ${CL_CHANNELS.length} channels...`,
  );
  const allDeals: Partial<Deal>[] = [];

  for (const city of CL_CITIES) {
    for (const channel of CL_CHANNELS) {
      const gen = paginate<Partial<Deal>>(
        CL_CONFIG,
        (page) =>
          `https://${city}.craigslist.org/search/${channel.path}?` +
          `query=${query}&min_price=${minPrice}&max_price=${maxPrice}&s=${(page - 1) * 120}`,
        async ($raw) => {
          const cheerio = await import("cheerio");
          const $ =
            typeof $raw === "string"
              ? cheerio.load($raw)
              : ($raw as ReturnType<typeof cheerio.load>);
          const items: Partial<Deal>[] = [];

          $(".cl-static-search-result, .cl-search-result, li.result-row").each(
            (_, el) => {
              const row = $(el);
              const title = row
                .find(".title, .title-anchor, a.result-title")
                .text()
                .trim();
              const priceText = row.find(".price").text().trim();
              const url = row.find("a").attr("href");
              const hood = row
                .find(".location, .hood")
                .text()
                .replace(/[()]/g, "")
                .trim();
              const imgSrc = row.find("img").attr("src");

              if (!title) return;

              items.push({
                source: channel.source,
                source_deal_id:
                  url?.split("/").pop()?.replace(".html", "") || "",
                source_url: url
                  ? normalizeUrl(url, `https://${city}.craigslist.org`)
                  : "",
                title,
                year: extractYear(title),
                make: title.split(" ").slice(1, 2).join("") || "",
                model: title.split(" ").slice(2, 4).join(" ") || "",
                ask_price: extractPrice(priceText) || 0,
                condition: "run_drive",
                location_city: hood || city,
                location_state: CL_SITE_STATE.get(city),
                seller_type:
                  channel.source === "craigslist_dealer" ? "dealer" : "private",
                images: imgSrc ? [imgSrc] : [],
              });
            },
          );

          const totalText = $(".totalcount").text();
          const total = parseInt(totalText) || 0;
          const offset = parseInt(
            new URL(
              $('link[rel="next"]').attr("href") || "",
              "https://craigslist.org",
            ).searchParams.get("s") || "0",
          );
          return { items, hasMore: offset < total && items.length > 0 };
        },
      );

      for await (const batch of gen) allDeals.push(...batch);
    }
  }

  console.log(`[Craigslist] Found ${allDeals.length} deals`);
  // Pull VIN / true mileage / title status from detail pages (bounded, $0).
  await enrichDeals(allDeals);
  await upsertDeals(allDeals);
  return allDeals.length;
}

// ════════════════════════════════════════════════════════════
//  INDEPENDENT DEALER CRAWLER
//  The core differentiator — crawls sites like:
//  AE of Miami 74 Auto, 111 Used Cars, STL Auction Pipeline, etc.
// ════════════════════════════════════════════════════════════
export const INDI_CONFIG: ScraperConfig = {
  name: "IndependentDealers",
  baseUrl: "", // set per-dealer
  renderMode: "browser",
  requestDelay: 2000,
  concurrency: 3,
  useProxies: true,
  stealth: true,
  maxPages: 20,
};

// Dealer site profiles — patterns we know how to parse
interface DealerProfile {
  dealerId: string;
  name: string;
  city: string;
  state: string;
  inventoryUrl: string;
  // CSS selectors for each data point
  selectors: {
    dealCard: string;
    title: string;
    price: string;
    mileage?: string;
    image?: string;
    link?: string;
    condition?: string;
    year?: string;
  };
  // Some dealers paginate via URL param
  pagination?: {
    param: string; // e.g. 'page' or 'start'
    style: "page" | "offset";
    perPage: number;
  };
  // JS-rendered sites need browser; static can use fetch
  renderMode?: "static" | "browser";
}

export const DEALER_PROFILES: DealerProfile[] = [
  // ── DealerSocket / VinSolutions powered dealers (very common)
  {
    dealerId: "generic-dealersocket",
    name: "DealerSocket Template",
    city: "",
    state: "",
    inventoryUrl: "/inventory",
    renderMode: "browser",
    selectors: {
      dealCard: '.vehicle-card, .inventory-deal, [class*="VehicleCard"]',
      title: '.vehicle-title, h2.title, [class*="vehicleTitle"]',
      price: '.price, [class*="Price"], .vehicle-price',
      mileage: '.mileage, [class*="mileage"]',
      image: 'img.vehicle-image, [class*="vehicleImage"] img',
      link: 'a[href*="/inventory/"]',
    },
    pagination: { param: "page", style: "page", perPage: 24 },
  },
  // ── WordPress + WP-Inventory dealers (many small lots use this)
  {
    dealerId: "generic-wp",
    name: "WordPress Auto Dealer",
    city: "",
    state: "",
    inventoryUrl: "/inventory",
    renderMode: "static",
    selectors: {
      dealCard: ".vehicle_deal, .car-deal, article.type-auto_deals",
      title: "h2.wpl-deal-title, .vehicle-name, h3.entry-title",
      price: ".wpl-price, .price, .vehicle-price",
      mileage: ".wpl-mileage, .mileage",
      image: ".vehicle-image img, .deal-image img",
      link: "a.deal-link, .vehicle-title a",
    },
    pagination: { param: "paged", style: "page", perPage: 12 },
  },
];

export async function scrapeIndependentDealer(
  profile: DealerProfile,
  baseUrl: string,
): Promise<number> {
  console.log(`[IndiDealer] Scraping ${profile.name} at ${baseUrl}`);
  const allDeals: Partial<Deal>[] = [];
  const config = {
    ...INDI_CONFIG,
    baseUrl,
    renderMode: profile.renderMode || "browser",
  };
  const sel = profile.selectors;

  const gen = paginate<Partial<Deal>>(
    config,
    (page) => {
      const url = new URL(profile.inventoryUrl, baseUrl);
      if (profile.pagination) {
        const offset =
          profile.pagination.style === "offset"
            ? (page - 1) * profile.pagination.perPage
            : page;
        url.searchParams.set(profile.pagination.param, String(offset));
      }
      return url.toString();
    },
    async (rawHtml) => {
      const cheerio = await import("cheerio");
      const $ = cheerio.load(typeof rawHtml === "string" ? rawHtml : "");
      const items: Partial<Deal>[] = [];

      $(sel.dealCard).each((_, el) => {
        const card = $(el);
        const title = card.find(sel.title).first().text().trim();
        const priceText = card.find(sel.price).first().text().trim();
        const mileText = sel.mileage
          ? card.find(sel.mileage).first().text().trim()
          : "";
        const imgSrc = sel.image
          ? card.find(sel.image).first().attr("src")
          : undefined;
        const href = sel.link
          ? card.find(sel.link).first().attr("href")
          : undefined;

        if (!title || title.length < 5) return;

        const price = extractPrice(priceText);
        if (!price || price < 100) return; // skip contact-for-price

        // Require a stable id from the listing URL so upsert dedupe works.
        const dealId = href?.split("/").filter(Boolean).pop();
        if (!dealId) return;

        items.push({
          source: "independent_dealer",
          source_deal_id: dealId,
          source_url: href ? normalizeUrl(href, baseUrl) : baseUrl,
          title,
          year: extractYear(title),
          make: title.split(" ").filter((w) => w.match(/[A-Z][a-z]+/))[0] || "",
          model: title.split(" ").slice(2, 4).join(" ") || "",
          ask_price: price,
          mileage: extractMileage(mileText),
          condition: "run_drive",
          location_city: profile.city,
          location_state: profile.state,
          images: imgSrc ? [normalizeUrl(imgSrc, baseUrl)] : [],
        });
      });

      // AI rescue: generic selectors match nothing on many dealer layouts. When that happens (and
      // the page genuinely has content), let the LLM extract the listings. Cost-gated — only fires
      // on a selector miss, only when a provider key + AI_SCRAPE_EXTRACT are configured.
      if (
        items.length === 0 &&
        typeof rawHtml === "string" &&
        rawHtml.length > 1500
      ) {
        const { aiExtractVehicles, aiExtractEnabled } =
          await import("../tools/ai-extract");
        if (aiExtractEnabled()) {
          const extracted = await aiExtractVehicles(rawHtml, baseUrl);
          for (const v of extracted) {
            if (!v.price || v.price < 100) continue;
            if (!v.make && !v.title) continue;
            items.push({
              source: "independent_dealer",
              source_deal_id:
                v.url?.split("/").filter(Boolean).pop() ||
                `${profile.dealerId}-${(v.title || "").slice(0, 40)}`,
              source_url: v.url ? normalizeUrl(v.url, baseUrl) : baseUrl,
              title:
                v.title || [v.year, v.make, v.model].filter(Boolean).join(" "),
              year: v.year,
              make: v.make || "",
              model: v.model || "",
              ask_price: v.price,
              mileage: v.mileage,
              condition: "run_drive",
              location_city: v.location_city || profile.city,
              location_state: v.location_state || profile.state,
              images: [],
            });
          }
          if (items.length)
            console.log(
              `[IndiDealer] ${profile.name}: AI-extracted ${items.length} (selector miss)`,
            );
        }
      }

      // Detect "no more results" — check for next page link or empty results
      const hasNext =
        $(
          'a[rel="next"], .pagination .next:not(.disabled), [aria-label="Next"]',
        ).length > 0;
      return { items, hasMore: hasNext && items.length > 0 };
    },
  );

  for await (const batch of gen) allDeals.push(...batch);

  console.log(`[IndiDealer] ${profile.name}: Found ${allDeals.length} deals`);
  await upsertDeals(
    allDeals.map((l) => ({ ...l, dealer_id: profile.dealerId })),
  );
  return allDeals.length;
}

// ── Generic "discover and crawl any dealer site" ─────────────────────────────
// Given just a website URL, this auto-detects the inventory pattern
export async function autoDiscoverAndCrawl(
  dealerWebsite: string,
): Promise<number> {
  console.log(`[AutoDiscover] Analyzing ${dealerWebsite}`);

  const { html, close } = await fetchBrowser(dealerWebsite, {
    ...INDI_CONFIG,
    baseUrl: dealerWebsite,
  });
  await close();

  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  // Find inventory link
  let inventoryUrl = "";
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().toLowerCase();
    if (
      /inventory|vehicles|stock|cars|used|available/i.test(text) ||
      /\/inventory|\/vehicles|\/used/i.test(href)
    ) {
      inventoryUrl = normalizeUrl(href, dealerWebsite);
      return false; // break
    }
  });

  if (!inventoryUrl) {
    console.warn(`[AutoDiscover] No inventory page found at ${dealerWebsite}`);
    return 0;
  }

  // Try to match a known profile pattern
  const matchedProfile = DEALER_PROFILES.find((p) =>
    p.selectors.dealCard.split(",").some((sel) => $(sel.trim()).length > 0),
  );

  const profile: DealerProfile = matchedProfile || {
    dealerId: `auto-${new URL(dealerWebsite).hostname}`,
    name: $("title").text() || dealerWebsite,
    city: "",
    state: "",
    inventoryUrl,
    renderMode: "browser",
    selectors: {
      // Best-effort generic selectors
      dealCard: [
        '[class*="vehicle"], [class*="deal"], [class*="inventory"], [class*="car-card"]',
        "article, .grid-item, .card",
      ].join(","),
      title: 'h1, h2, h3, [class*="title"], [class*="name"]',
      price: '[class*="price"], [class*="Price"]',
      mileage: '[class*="mile"], [class*="odometer"]',
      image: "img",
      link: "a[href]",
    },
    pagination: { param: "page", style: "page", perPage: 24 },
  };

  return scrapeIndependentDealer(profile, dealerWebsite);
}

// Re-export other source modules
export { scrapeEbayMotors, EBAY_MOTORS_CONFIG } from "./ebay-motors";
export { scrapeIAA } from "./iaa";
export { scrapeAcv, ACV_CONFIG } from "./acv";
export { scrapeCarPartsCom, CARPARTS_COM_CONFIG } from "./carparts-com";
export {
  scrapeFacebookMarketplace,
  FACEBOOK_MARKETPLACE_CONFIG,
} from "./facebook-marketplace";
export { scrapeAdesa, ADESA_CONFIG } from "./adesa";
export { scrapeManheim, MANHEIM_CONFIG } from "./manheim";
export {
  scrapeCarsCom,
  scrapeCarsComAllStates,
  CARS_COM_CONFIG,
} from "./cars-com";
