// lib/scrapers/runner.ts
// Central scraper runner. Wires sources into a registry and provides multiple orchestrators.

import {
  scrapeCopart,
  scrapeCraigslist,
  scrapeIndependentDealer,
  autoDiscoverAndCrawl,
  scrapeCuratedSites,
  scrapeCarsCom,
  scrapeCarsComAllStates,
} from "./sources/index";
import { scrapeEbayMotors } from "./sources/ebay-motors";
import { scrapeIAA } from "./sources/iaa";
import { scrapeAcv } from "./sources/acv";
import { scrapeCarPartsCom } from "./sources/carparts-com";
import { scrapeFacebookMarketplace } from "./sources/facebook-marketplace";
import { scrapeAdesa } from "./sources/adesa";
import { scrapeManheim } from "./sources/manheim";
// Retail comps sources (coded, no auth) — feed the comps index that powers valuation + Deal IQ.
import { scrapeCarvana } from "./sources/carvana";
import { scrapeVroom } from "./sources/vroom";
import { scrapeTrueCar } from "./sources/truecar";
import { scrapeCarGurus } from "./sources/cargurus";
import { scrapeAutoTrader } from "./sources/autotrader";
import { scrapeOfferUp } from "./sources/offerup";
import { scrapePublicSurplus } from "./sources/publicsurplus";
import { scrapeAutotempest } from "./sources/autotempest";
import { scrapeEbaySold } from "./sources/ebay-sold";
import { ScraperRegistry } from "./tools/registry";
import {
  recordScrapeRuns,
  getSkipSources,
  type SourceRunResult,
} from "./health";
import {
  SequentialOrchestrator,
  ConcurrentOrchestrator,
  PriorityOrchestrator,
  QueueOrchestrator,
  RealtimeOrchestrator,
  type OrchestratorOptions,
} from "./orchestrators";
export type OrchestratorType =
  | "sequential"
  | "concurrent"
  | "priority"
  | "queue"
  | "realtime";

export interface RunScraperOptions {
  orchestrator?: OrchestratorType;
  sourceIds?: string[];
  concurrency?: number;
  dryRun?: boolean;
  redisUrl?: string;
  onProgress?: (progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
    currentSource?: string;
  }) => void;
  onSourceComplete?: (result: {
    source: string;
    success: boolean;
    dealsFound: number;
    duration: number;
    error?: string;
  }) => void;
}

// Create and configure the central scraper registry
export function createScraperRegistry(
  stateManager?: import("./tools/state").ScraperStateManager,
): ScraperRegistry {
  const registry = new ScraperRegistry(stateManager);

  registry.register({
    id: "copart",
    name: "Copart",
    type: "auction",
    priority: "high",
    frequencyMinutes: 360,
    requiresAuth: false, // open /public/lots/search-results JSON API — no login, no FlareSolverr
    stealthRequired: false,
    fn: () => scrapeCopart(),
    enabled: true,
    estimatedDealsPerRun: 300,
  });

  registry.register({
    id: "craigslist",
    name: "Craigslist",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 30,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeCraigslist(),
    enabled: true,
    estimatedDealsPerRun: 500,
  });

  registry.register({
    id: "iaa",
    name: "IAA",
    type: "auction",
    priority: "high",
    frequencyMinutes: 60,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeIAA(),
    enabled: false, // gated (no open public feed like Copart); was producing ~0 while wasting a cycle.
    estimatedDealsPerRun: 150,
  });

  registry.register({
    id: "acv",
    name: "ACV Auctions",
    type: "auction",
    priority: "high",
    frequencyMinutes: 60,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeAcv(),
    enabled: false,
    estimatedDealsPerRun: 100,
  });

  registry.register({
    id: "adesa",
    name: "ADESA",
    type: "auction",
    priority: "high",
    frequencyMinutes: 60,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeAdesa(),
    enabled: false,
    estimatedDealsPerRun: 100,
  });

  registry.register({
    id: "manheim",
    name: "Manheim",
    type: "auction",
    priority: "high",
    frequencyMinutes: 60,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeManheim(),
    enabled: false,
    estimatedDealsPerRun: 100,
  });

  registry.register({
    id: "facebook_marketplace",
    name: "Facebook Marketplace",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 120,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeFacebookMarketplace(),
    enabled: false,
    estimatedDealsPerRun: 200,
  });

  registry.register({
    id: "ebay_motors",
    name: "eBay Motors",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 240,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeEbayMotors(),
    enabled: true,
    estimatedDealsPerRun: 300,
  });

  registry.register({
    id: "carparts_com",
    name: "CarParts.com",
    type: "parts",
    priority: "high",
    frequencyMinutes: 240,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeCarPartsCom(),
    enabled: true,
    estimatedDealsPerRun: 300,
  });

  // Retail comps — high value for pricing, comps, and market intelligence (from research)
  registry.register({
    id: "cars_com",
    name: "Cars.com",
    type: "marketplace",
    priority: "high",
    frequencyMinutes: 120,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeCarsComAllStates(),
    // Disabled: Cloudflare-walled — 0/50 states, "direct + FlareSolverr exhausted". AutoTempest
    // aggregates Cars.com listings for us (2498 deals/run), so no retail data is lost. Re-enable only
    // behind a working FlareSolverr or residential-proxy bypass (no-paid-services rules that out today).
    enabled: false,
    estimatedDealsPerRun: 400,
  });

  registry.register({
    id: "independent_dealer",
    name: "Independent Dealers",
    type: "dealer",
    priority: "medium",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: true,
    fn: async () => {
      // Scrape a batch of known dealer profiles. DEALER_PROFILES today holds only parser TEMPLATES
      // (relative inventoryUrl like "/inventory", no base domain) — they're meant to be applied to
      // discovered sites, not crawled standalone, so skip any non-absolute URL. Per-profile try/catch
      // so one bad site can never zero the whole source (an Invalid-URL throw used to do exactly that).
      const { DEALER_PROFILES } = await import("./sources/index");
      let total = 0;
      for (const profile of DEALER_PROFILES) {
        if (!/^https?:\/\//i.test(profile.inventoryUrl)) continue;
        try {
          total += await scrapeIndependentDealer(profile, profile.inventoryUrl);
        } catch (e) {
          console.warn(
            `[IndiDealer] ${profile.name} failed: ${(e as Error).message}`,
          );
        }
      }
      return total;
    },
    // Disabled: no real (absolute-URL) profiles exist — only templates, so it produced nothing but
    // "Invalid URL" errors every run. Real dealer crawling is handled by curated_dealers (95 sites).
    // Re-enable once DEALER_PROFILES gains absolute-URL entries (the loop above is now crash-safe).
    enabled: false,
    estimatedDealsPerRun: 100,
  });

  // ── Retail comps (coded sources, no auth). More retail asks → sharper resale comps →
  //    better verdicts + Deal IQ. Lower frequency to stay polite. ──
  registry.register({
    id: "cargurus",
    name: "CarGurus",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 240,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeCarGurus(),
    // Disabled: bot-walled — its ajax inventory endpoint returns HTTP 406 (PerimeterX). AutoTempest
    // surfaces CarGurus listings without hitting the wall, so retail comps are covered.
    enabled: false,
    estimatedDealsPerRun: 300,
  });

  registry.register({
    id: "autotrader",
    name: "AutoTrader",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 240,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeAutoTrader(),
    // Disabled: Akamai-walled — returns an "Autotrader - page unavailable" interstitial, not data.
    // AutoTempest aggregates AutoTrader listings, so retail coverage is preserved without the wall.
    enabled: false,
    estimatedDealsPerRun: 300,
  });

  registry.register({
    id: "truecar",
    name: "TrueCar",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeTrueCar(),
    // Disabled: PerimeterX-walled — its abp/api listings endpoint returns a captcha challenge
    // (appId PXVDPSla5w, blockScript), not JSON. AutoTempest carries TrueCar listings instead.
    enabled: false,
    estimatedDealsPerRun: 250,
  });

  registry.register({
    id: "carvana",
    name: "Carvana",
    type: "marketplace",
    priority: "high", // open JSON API, ~73k clean retail comps, no FlareSolverr needed
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeCarvana(),
    enabled: true,
    estimatedDealsPerRun: 750,
  });

  registry.register({
    id: "vroom",
    name: "Vroom",
    type: "marketplace",
    priority: "low",
    frequencyMinutes: 720,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeVroom(),
    enabled: false, // Vroom halted all car sales Jan 22, 2024 — no inventory to scrape
    estimatedDealsPerRun: 0,
  });

  // eBay SOLD — real completed-sale prices (not asking) into sold_listings. Honest transaction data
  // for the budget/salvage segment. Fetched via system curl (passes eBay's sold-page bot wall).
  registry.register({
    id: "ebay_sold",
    name: "eBay Sold (real prices)",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 720,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeEbaySold(),
    enabled: true,
    estimatedDealsPerRun: 800,
  });

  // Autotempest — meta-search aggregator (open API). One pass pulls Cars.com/CarGurus/Carvana/eBay/
  // AutoTrader/TrueCar/CarMax/Facebook/Hemmings listings, bypassing each site's bot wall at once.
  // Curated salvage-rebuilder + independent dealer network (we maintain the list; AI/generic crawler
  // ingests each from its URL). The dealer-to-dealer rebuildable-car moat. Browser-based → CI only.
  registry.register({
    id: "curated_dealers",
    name: "Curated salvage/dealer network",
    type: "dealer",
    priority: "medium",
    frequencyMinutes: 720,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeCuratedSites(),
    enabled: true,
    estimatedDealsPerRun: 200,
  });

  registry.register({
    id: "autotempest",
    name: "Autotempest (aggregator)",
    type: "marketplace",
    priority: "high",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeAutotempest(),
    enabled: true,
    estimatedDealsPerRun: 400,
  });

  // PublicSurplus — gov/municipal surplus auctions (open, no login). Police/fleet cars + trucks
  // at a fraction of retail = prime cheap-acquisition leads. catid 403 Auto + 404 Truck.
  registry.register({
    id: "publicsurplus",
    name: "PublicSurplus (gov surplus)",
    type: "auction",
    priority: "high",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapePublicSurplus(),
    enabled: true,
    estimatedDealsPerRun: 130,
  });

  registry.register({
    id: "offerup",
    name: "OfferUp",
    type: "marketplace",
    priority: "low",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeOfferUp(),
    enabled: true,
    estimatedDealsPerRun: 150,
  });

  registry.register({
    id: "auto_discover",
    name: "Auto Discover Dealer",
    type: "dealer",
    priority: "low",
    frequencyMinutes: 1440,
    requiresAuth: false,
    stealthRequired: true,
    fn: async () => {
      // Example: auto-discover a dealer site from env
      const url = process.env.AUTO_DISCOVER_DEALER_URL;
      if (!url) return 0;
      return autoDiscoverAndCrawl(url);
    },
    enabled: false,
    estimatedDealsPerRun: 20,
  });

  return registry;
}

// Build orchestrator options from user options
function buildOrchestratorOptions(
  options: RunScraperOptions,
): OrchestratorOptions {
  return {
    logToConsole: true,
    dryRun: options.dryRun || false,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    onProgress: (progress) => {
      options.onProgress?.({
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        percentage: progress.percentage,
        currentSource: progress.currentSource,
      });
    },
    onSourceComplete: (result) => {
      options.onSourceComplete?.({
        source: result.source,
        success: result.success,
        dealsFound: result.dealsFound,
        duration: result.duration,
        error: result.error,
      });
    },
  };
}

// Main entry point: run the scraper with chosen orchestrator
export async function runScrapers(options: RunScraperOptions = {}) {
  const registry = createScraperRegistry();

  // Self-healing: drop sources whose last few runs all failed (they retry after a cooldown). Skipped
  // only when running a batch — an explicit single-source request is always honored.
  let sourceIds = options.sourceIds;
  const collected: SourceRunResult[] = [];
  if (!options.dryRun && (!sourceIds || sourceIds.length > 1)) {
    const skip = await getSkipSources();
    if (skip.size) {
      const enabled = registry.getEnabled().map((s) => s.id);
      const base = sourceIds && sourceIds.length ? sourceIds : enabled;
      if (base.length) {
        const kept = base.filter((id: string) => !skip.has(id));
        if (kept.length && kept.length < base.length) {
          sourceIds = kept;
          console.log(
            `[runScrapers] self-heal: skipping ${Array.from(skip).join(", ")} (recent failures)`,
          );
        }
      }
    }
  }

  // Capture each source's outcome for health recording (wraps any caller-provided callback).
  const userOnComplete = options.onSourceComplete;
  const wrapped: RunScraperOptions = {
    ...options,
    sourceIds,
    onSourceComplete: (r) => {
      collected.push({
        source: r.source,
        ok: r.success,
        dealsFound: r.dealsFound ?? 0,
        durationMs: r.duration,
        error: r.error ? String(r.error) : undefined,
      });
      userOnComplete?.(r);
    },
  };

  const baseOptions = buildOrchestratorOptions(wrapped);
  options = wrapped;
  const orchestratorType = options.orchestrator || "concurrent";

  let orchestrator;
  switch (orchestratorType) {
    case "sequential":
      orchestrator = new SequentialOrchestrator(registry, baseOptions);
      break;
    case "concurrent":
      orchestrator = new ConcurrentOrchestrator(registry, {
        ...baseOptions,
        concurrency: options.concurrency || 3,
      });
      break;
    case "priority":
      orchestrator = new PriorityOrchestrator(registry, {
        ...baseOptions,
        concurrencyPerPriority: options.concurrency || 3,
      });
      break;
    case "queue":
      orchestrator = new QueueOrchestrator(registry, {
        ...baseOptions,
        redisUrl: options.redisUrl,
        workerConcurrency: options.concurrency || 3,
      });
      break;
    case "realtime":
      orchestrator = new RealtimeOrchestrator(registry, {
        ...baseOptions,
        concurrency: options.concurrency || 3,
        maxContinuousRuns: 1,
      });
      break;
    default:
      throw new Error(`Unknown orchestrator type: ${orchestratorType}`);
  }

  const result = await orchestrator.run(options.sourceIds);
  // Persist per-source health (awaited so it lands before a short-lived CI process exits).
  await recordScrapeRuns(collected);
  return result;
}

// Backward-compatible DailyRefreshManager
export class DailyRefreshManager {
  private registry: ScraperRegistry;
  private options: OrchestratorOptions;

  constructor() {
    this.registry = createScraperRegistry();
    this.options = {
      logToConsole: true,
      dryRun: false,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  async runDailyRefresh(
    source?: string,
  ): Promise<
    { source: string; success: boolean; dealsFound: number; error?: string }[]
  > {
    const orchestrator = new ConcurrentOrchestrator(this.registry, {
      ...this.options,
      concurrency: 2,
    });

    const results = await orchestrator.run(source ? [source] : undefined);
    return results.map((r) => ({
      source: r.source,
      success: r.success,
      dealsFound: r.dealsFound,
      error: r.error,
    }));
  }
}

// Quick helpers for direct use
export async function runSequential(sourceIds?: string[]) {
  return runScrapers({ orchestrator: "sequential", sourceIds });
}

export async function runConcurrent(
  sourceIds?: string[],
  concurrency?: number,
) {
  return runScrapers({ orchestrator: "concurrent", sourceIds, concurrency });
}

export async function runPriority(sourceIds?: string[], concurrency?: number) {
  return runScrapers({ orchestrator: "priority", sourceIds, concurrency });
}

export async function runQueue(sourceIds?: string[], concurrency?: number) {
  return runScrapers({ orchestrator: "queue", sourceIds, concurrency });
}

export async function runRealtime(sourceIds?: string[], concurrency?: number) {
  return runScrapers({ orchestrator: "realtime", sourceIds, concurrency });
}

export * from "./orchestrators";
export * from "./tools";
