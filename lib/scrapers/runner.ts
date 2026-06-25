// lib/scrapers/runner.ts
// Central scraper runner. Wires sources into a registry and provides multiple orchestrators.

import {
  scrapeCopart,
  scrapeCraigslist,
  scrapeIndependentDealer,
  autoDiscoverAndCrawl,
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
import { scrapeBringATrailer } from "./sources/bring-a-trailer";
import { scrapeCarMax } from "./sources/carmax";
// New sources — full selection list
import { scrapeGovPlanet } from "./sources/govplanet";
import { scrapeMecum } from "./sources/mecum";
import { scrapeHemmings } from "./sources/hemmings";
import { scrapeBarrettJackson } from "./sources/barrett-jackson";
import { scrapeEdmunds } from "./sources/edmunds";
import { scrapeKbb } from "./sources/kbb";
import { scrapeISeeCars } from "./sources/iseecars";
import { scrapeDriveway } from "./sources/driveway";
import { scrapeLkq } from "./sources/lkq";
import { scrapeAutoTempest } from "./sources/autotempest";
import { scrapeCarsDirect } from "./sources/carsdirect";
import { scrapeTradeRev } from "./sources/traderev";
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
    frequencyMinutes: 15,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeCopart(),
    enabled: true,
    estimatedDealsPerRun: 250,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
      // Known independent dealer domains — add real URLs here as you discover good sources.
      // Each entry: { profile: DealerProfile, baseUrl: string (the dealer's actual domain) }
      const { DEALER_PROFILES } = await import("./sources/index");
      const DEALER_URLS: { profileId: string; baseUrl: string }[] = [
        // Add real dealer URLs here, e.g.:
        // { profileId: "generic-dealersocket", baseUrl: "https://www.example-dealer.com" },
      ];
      if (!DEALER_URLS.length) {
        console.log("[IndependentDealer] No dealer URLs configured — add them to runner.ts DEALER_URLS");
        return 0;
      }
      let total = 0;
      for (const { profileId, baseUrl } of DEALER_URLS) {
        const profile = DEALER_PROFILES.find(p => p.dealerId === profileId) || DEALER_PROFILES[0];
        total += await scrapeIndependentDealer(profile, baseUrl);
      }
      return total;
    },
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
    estimatedDealsPerRun: 250,
  });

  registry.register({
    id: "carvana",
    name: "Carvana",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeCarvana(),
    enabled: true,
    estimatedDealsPerRun: 200,
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
    enabled: true,
    estimatedDealsPerRun: 150,
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
    id: "bring_a_trailer",
    name: "Bring a Trailer",
    type: "auction",
    priority: "medium",
    frequencyMinutes: 120,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeBringATrailer(),
    enabled: true,
    estimatedDealsPerRun: 150,
  });

  registry.register({
    id: "carmax",
    name: "CarMax",
    type: "marketplace",
    priority: "high",
    frequencyMinutes: 240,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeCarMax(),
    enabled: true,
    estimatedDealsPerRun: 350,
  });

  // ── New sources: full user-selectable fleet ──────────────────────────────────
  registry.register({
    id: "govplanet",
    name: "GovPlanet",
    type: "auction",
    priority: "high",
    frequencyMinutes: 120,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeGovPlanet(),
    enabled: true,
    estimatedDealsPerRun: 200,
  });

  registry.register({
    id: "mecum",
    name: "Mecum Auctions",
    type: "auction",
    priority: "medium",
    frequencyMinutes: 240,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeMecum(),
    enabled: true,
    estimatedDealsPerRun: 150,
  });

  registry.register({
    id: "hemmings",
    name: "Hemmings",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeHemmings(),
    enabled: true,
    estimatedDealsPerRun: 200,
  });

  registry.register({
    id: "barrett_jackson",
    name: "Barrett-Jackson",
    type: "auction",
    priority: "medium",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeBarrettJackson(),
    enabled: true,
    estimatedDealsPerRun: 100,
  });

  registry.register({
    id: "edmunds",
    name: "Edmunds",
    type: "marketplace",
    priority: "high",
    frequencyMinutes: 240,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeEdmunds(),
    enabled: true,
    estimatedDealsPerRun: 300,
  });

  registry.register({
    id: "kbb",
    name: "Kelley Blue Book",
    type: "marketplace",
    priority: "high",
    frequencyMinutes: 240,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeKbb(),
    enabled: true,
    estimatedDealsPerRun: 300,
  });

  registry.register({
    id: "iseecars",
    name: "iSeeCars",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeISeeCars(),
    enabled: true,
    estimatedDealsPerRun: 200,
  });

  registry.register({
    id: "driveway",
    name: "Driveway",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeDriveway(),
    enabled: true,
    estimatedDealsPerRun: 150,
  });

  registry.register({
    id: "lkq",
    name: "LKQ / Row52",
    type: "parts",
    priority: "low",
    frequencyMinutes: 720,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeLkq(),
    enabled: true,
    estimatedDealsPerRun: 400,
  });

  registry.register({
    id: "autotempest",
    name: "AutoTempest",
    type: "marketplace",
    priority: "low",
    frequencyMinutes: 480,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeAutoTempest(),
    enabled: true,
    estimatedDealsPerRun: 200,
  });

  registry.register({
    id: "carsdirect",
    name: "CarsDirect",
    type: "marketplace",
    priority: "medium",
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeCarsDirect(),
    enabled: true,
    estimatedDealsPerRun: 250,
  });

  registry.register({
    id: "traderev",
    name: "TradeRev",
    type: "auction",
    priority: "high",
    frequencyMinutes: 120,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeTradeRev(),
    enabled: true,
    estimatedDealsPerRun: 200,
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
    enabled: true,
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
