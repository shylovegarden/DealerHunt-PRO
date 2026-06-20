// lib/scrapers/examples/usage.ts
// Examples of how to use the new orchestrator system.

import {
  runScrapers,
  runConcurrent,
  runPriority,
  runQueue,
  runRealtime,
  createScraperRegistry,
  SequentialOrchestrator,
  ConcurrentOrchestrator,
  PriorityOrchestrator,
  QueueOrchestrator,
  RealtimeOrchestrator,
  BrowserPoolManager,
  ProxyManager,
  QualityController,
} from '../runner'
import { startScraperWorker } from '../worker'
import { ScraperScheduler } from '../scheduler'
import { scrapeEbayMotors } from '../sources/ebay-motors'
import { scrapeIaa } from '../sources/iaa'
import { scrapeAcv } from '../sources/acv'
import { scrapeCarPartsCom } from '../sources/carparts-com'
import { scrapeFacebookMarketplace } from '../sources/facebook-marketplace'
import { scrapeAdesa } from '../sources/adesa'
import { scrapeManheim } from '../sources/manheim'

// Example 1: Run all enabled sources concurrently with default settings
export async function exampleConcurrent() {
  const results = await runConcurrent()
  console.log('Concurrent results:', results)
  return results
}

// Example 2: Run only specific sources with progress callbacks
export async function exampleSpecificSources() {
  const results = await runScrapers({
    orchestrator: 'concurrent',
    sourceIds: ['copart', 'craigslist'],
    concurrency: 2,
    onProgress: (progress) => {
      console.log(`Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`)
    },
    onSourceComplete: (result) => {
      console.log(`Completed ${result.source}: ${result.dealsFound} deals`)
    },
  })
  return results
}

// Example 3: Priority-based execution (high priority auctions first)
export async function examplePriority() {
  const results = await runPriority(undefined, 3)
  return results
}

// Example 4: Queue-based distributed execution
export async function exampleQueue() {
  const registry = createScraperRegistry()
  const orchestrator = new QueueOrchestrator(registry, {
    redisUrl: process.env.REDIS_URL,
    workerConcurrency: 3,
  })

  // Enqueue jobs
  await orchestrator.enqueue()

  // Process queue
  const results = await orchestrator.run()
  await orchestrator.stop()
  return results
}

// Example 5: Real-time continuous execution
export async function exampleRealtime() {
  const results = await runRealtime(undefined, 3)
  return results
}

// Example 6: Sequential execution for debugging
export async function exampleSequential() {
  const registry = createScraperRegistry()
  const orchestrator = new SequentialOrchestrator(registry, { dryRun: true })
  const results = await orchestrator.run(['copart', 'craigslist'])
  return results
}

// Example 7: Using the browser pool and proxy manager
export async function exampleBrowserAndProxy() {
  const proxyManager = new ProxyManager()
  const browserPool = new BrowserPoolManager({ proxyManager, maxBrowsers: 2 })

  const { page, release } = await browserPool.getPage('example-source')
  await page.goto('https://example.com')
  await page.waitForTimeout(1000)
  await release()
  await browserPool.close()
}

// Example 8: Quality control
export async function exampleQualityControl() {
  const controller = new QualityController()
  const sampleDeals = [
    { source: 'copart', title: '2019 Ford F-150', ask_price: 14200, mileage: 78000, year: 2019 },
    { source: 'copart', title: 'Bad', ask_price: -100, mileage: 78000, year: 2019 },
    { source: 'craigslist', title: '2020 Toyota Camry', ask_price: 16500, mileage: 42000, year: 2020 },
  ]

  const report = controller.validateBatch('test', sampleDeals)
  console.log('Quality report:', report)
  return report
}

// Example 9: Custom registry with your own sources
export async function exampleCustomRegistry() {
  const registry = createScraperRegistry()

  registry.register({
    id: 'my_custom_source',
    name: 'My Custom Source',
    type: 'dealer',
    priority: 'medium',
    frequencyMinutes: 60,
    requiresAuth: false,
    stealthRequired: false,
    fn: async () => {
      // Your custom scraping logic here
      return 42
    },
    enabled: true,
    estimatedDealsPerRun: 50,
  })

  const orchestrator = new ConcurrentOrchestrator(registry, { concurrency: 2 })
  return orchestrator.run(['my_custom_source'])
}

// Example 10: Programmatic orchestrator selection
export async function exampleSwitchableOrchestrator(type: 'sequential' | 'concurrent' | 'priority' | 'queue' | 'realtime') {
  const results = await runScrapers({
    orchestrator: type,
    concurrency: 3,
  })
  return results
}

// Example 11: Direct scraper examples for all new sources
export async function exampleEbayMotors() {
  const count = await scrapeEbayMotors(3)
  console.log(`eBay Motors scraped ${count} deals`)
  return count
}

export async function exampleIaa() {
  const count = await scrapeIaa(['ford', 'toyota'], 2)
  console.log(`IAA scraped ${count} deals`)
  return count
}

export async function exampleAcv() {
  const count = await scrapeAcv(2)
  console.log(`ACV scraped ${count} deals`)
  return count
}

export async function exampleCarPartsCom() {
  const count = await scrapeCarPartsCom(2)
  console.log(`CarParts.com scraped ${count} deals`)
  return count
}

export async function exampleFacebookMarketplace() {
  const count = await scrapeFacebookMarketplace(['ford f150'], 1)
  console.log(`Facebook Marketplace scraped ${count} deals`)
  return count
}

export async function exampleAdesa() {
  const count = await scrapeAdesa(2)
  console.log(`ADESA scraped ${count} deals`)
  return count
}

export async function exampleManheim() {
  const count = await scrapeManheim(2)
  console.log(`Manheim scraped ${count} deals`)
  return count
}

// Example 12: Distributed queue worker
export async function exampleQueueWorker() {
  const worker = await startScraperWorker({
    workerConcurrency: 3,
    maxRuntimeMinutes: 30,
  })
  await worker.waitUntilStopped()
  return worker
}

// Example 12: Scheduler service
export async function exampleScheduler() {
  const scheduler = new ScraperScheduler({
    mode: 'concurrent',
    concurrency: 3,
    minIntervalMinutes: 5,
    onSchedule: (ids, next) => {
      console.log(`Scheduled ${ids.length} sources. Next check: ${next.toISOString()}`)
    },
  })

  await scheduler.start()
  // In real use, keep process alive. Here we stop after 5 minutes for demo.
  setTimeout(() => scheduler.stop(), 5 * 60 * 1000)
  return scheduler
}
