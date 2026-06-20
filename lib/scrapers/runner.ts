// lib/scrapers/runner.ts
// Central scraper runner. Wires sources into a registry and provides multiple orchestrators.

import { scrapeCopart, scrapeCraigslist, scrapeIndependentDealer, autoDiscoverAndCrawl } from './sources/index'
import { scrapeEbayMotors } from './sources/ebay-motors'
import { scrapeIAA } from './sources/iaa'
import { scrapeAcv } from './sources/acv'
import { scrapeCarPartsCom } from './sources/carparts-com'
import { scrapeFacebookMarketplace } from './sources/facebook-marketplace'
import { scrapeAdesa } from './sources/adesa'
import { scrapeManheim } from './sources/manheim'
import { ScraperRegistry } from './tools/registry'
import {
  SequentialOrchestrator,
  ConcurrentOrchestrator,
  PriorityOrchestrator,
  QueueOrchestrator,
  RealtimeOrchestrator,
  type OrchestratorOptions,
} from './orchestrators'
export type OrchestratorType = 'sequential' | 'concurrent' | 'priority' | 'queue' | 'realtime'

export interface RunScraperOptions {
  orchestrator?: OrchestratorType
  sourceIds?: string[]
  concurrency?: number
  dryRun?: boolean
  redisUrl?: string
  onProgress?: (progress: { total: number; completed: number; failed: number; percentage: number; currentSource?: string }) => void
  onSourceComplete?: (result: { source: string; success: boolean; dealsFound: number; duration: number; error?: string }) => void
}

// Create and configure the central scraper registry
export function createScraperRegistry(stateManager?: import('./tools/state').ScraperStateManager): ScraperRegistry {
  const registry = new ScraperRegistry(stateManager)

  registry.register({
    id: 'copart',
    name: 'Copart',
    type: 'auction',
    priority: 'high',
    frequencyMinutes: 15,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeCopart(),
    enabled: true,
    estimatedDealsPerRun: 250,
  })

  registry.register({
    id: 'craigslist',
    name: 'Craigslist',
    type: 'marketplace',
    priority: 'medium',
    frequencyMinutes: 30,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeCraigslist(),
    enabled: true,
    estimatedDealsPerRun: 500,
  })

  registry.register({
    id: 'iaa',
    name: 'IAA',
    type: 'auction',
    priority: 'high',
    frequencyMinutes: 60,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeIAA(),
    enabled: false,
    estimatedDealsPerRun: 150,
  })

  registry.register({
    id: 'acv',
    name: 'ACV Auctions',
    type: 'auction',
    priority: 'high',
    frequencyMinutes: 60,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeAcv(),
    enabled: false,
    estimatedDealsPerRun: 100,
  })

  registry.register({
    id: 'adesa',
    name: 'ADESA',
    type: 'auction',
    priority: 'high',
    frequencyMinutes: 60,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeAdesa(),
    enabled: false,
    estimatedDealsPerRun: 100,
  })

  registry.register({
    id: 'manheim',
    name: 'Manheim',
    type: 'auction',
    priority: 'high',
    frequencyMinutes: 60,
    requiresAuth: true,
    stealthRequired: true,
    fn: () => scrapeManheim(),
    enabled: false,
    estimatedDealsPerRun: 100,
  })

  registry.register({
    id: 'facebook_marketplace',
    name: 'Facebook Marketplace',
    type: 'marketplace',
    priority: 'medium',
    frequencyMinutes: 120,
    requiresAuth: false,
    stealthRequired: true,
    fn: () => scrapeFacebookMarketplace(),
    enabled: false,
    estimatedDealsPerRun: 200,
  })

  registry.register({
    id: 'ebay_motors',
    name: 'eBay Motors',
    type: 'marketplace',
    priority: 'medium',
    frequencyMinutes: 240,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeEbayMotors(),
    enabled: true,
    estimatedDealsPerRun: 300,
  })

  registry.register({
    id: 'carparts_com',
    name: 'CarParts.com',
    type: 'parts',
    priority: 'low',
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: false,
    fn: () => scrapeCarPartsCom(),
    enabled: false,
    estimatedDealsPerRun: 300,
  })

  registry.register({
    id: 'independent_dealer',
    name: 'Independent Dealers',
    type: 'dealer',
    priority: 'medium',
    frequencyMinutes: 360,
    requiresAuth: false,
    stealthRequired: true,
    fn: async () => {
      // Scrape a batch of known dealer profiles
      const { DEALER_PROFILES } = await import('./sources/index')
      let total = 0
      for (const profile of DEALER_PROFILES) {
        total += await scrapeIndependentDealer(profile, profile.inventoryUrl)
      }
      return total
    },
    enabled: true,
    estimatedDealsPerRun: 100,
  })

  registry.register({
    id: 'auto_discover',
    name: 'Auto Discover Dealer',
    type: 'dealer',
    priority: 'low',
    frequencyMinutes: 1440,
    requiresAuth: false,
    stealthRequired: true,
    fn: async () => {
      // Example: auto-discover a dealer site from env
      const url = process.env.AUTO_DISCOVER_DEALER_URL
      if (!url) return 0
      return autoDiscoverAndCrawl(url)
    },
    enabled: false,
    estimatedDealsPerRun: 20,
  })

  return registry
}

// Build orchestrator options from user options
function buildOrchestratorOptions(options: RunScraperOptions): OrchestratorOptions {
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
      })
    },
    onSourceComplete: (result) => {
      options.onSourceComplete?.({
        source: result.source,
        success: result.success,
        dealsFound: result.dealsFound,
        duration: result.duration,
        error: result.error,
      })
    },
  }
}

// Main entry point: run the scraper with chosen orchestrator
export async function runScrapers(options: RunScraperOptions = {}) {
  const registry = createScraperRegistry()
  const baseOptions = buildOrchestratorOptions(options)
  const orchestratorType = options.orchestrator || 'concurrent'

  let orchestrator
  switch (orchestratorType) {
    case 'sequential':
      orchestrator = new SequentialOrchestrator(registry, baseOptions)
      break
    case 'concurrent':
      orchestrator = new ConcurrentOrchestrator(registry, {
        ...baseOptions,
        concurrency: options.concurrency || 3,
      })
      break
    case 'priority':
      orchestrator = new PriorityOrchestrator(registry, {
        ...baseOptions,
        concurrencyPerPriority: options.concurrency || 3,
      })
      break
    case 'queue':
      orchestrator = new QueueOrchestrator(registry, {
        ...baseOptions,
        redisUrl: options.redisUrl,
        workerConcurrency: options.concurrency || 3,
      })
      break
    case 'realtime':
      orchestrator = new RealtimeOrchestrator(registry, {
        ...baseOptions,
        concurrency: options.concurrency || 3,
        maxContinuousRuns: 1,
      })
      break
    default:
      throw new Error(`Unknown orchestrator type: ${orchestratorType}`)
  }

  return orchestrator.run(options.sourceIds)
}

// Backward-compatible DailyRefreshManager
export class DailyRefreshManager {
  private registry: ScraperRegistry
  private options: OrchestratorOptions

  constructor() {
    this.registry = createScraperRegistry()
    this.options = {
      logToConsole: true,
      dryRun: false,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
  }

  async runDailyRefresh(source?: string): Promise<{ source: string; success: boolean; dealsFound: number; error?: string }[]> {
    const orchestrator = new ConcurrentOrchestrator(this.registry, {
      ...this.options,
      concurrency: 2,
    })

    const results = await orchestrator.run(source ? [source] : undefined)
    return results.map(r => ({
      source: r.source,
      success: r.success,
      dealsFound: r.dealsFound,
      error: r.error,
    }))
  }
}

// Quick helpers for direct use
export async function runSequential(sourceIds?: string[]) {
  return runScrapers({ orchestrator: 'sequential', sourceIds })
}

export async function runConcurrent(sourceIds?: string[], concurrency?: number) {
  return runScrapers({ orchestrator: 'concurrent', sourceIds, concurrency })
}

export async function runPriority(sourceIds?: string[], concurrency?: number) {
  return runScrapers({ orchestrator: 'priority', sourceIds, concurrency })
}

export async function runQueue(sourceIds?: string[], concurrency?: number) {
  return runScrapers({ orchestrator: 'queue', sourceIds, concurrency })
}

export async function runRealtime(sourceIds?: string[], concurrency?: number) {
  return runScrapers({ orchestrator: 'realtime', sourceIds, concurrency })
}

export * from './orchestrators'
export * from './tools'
