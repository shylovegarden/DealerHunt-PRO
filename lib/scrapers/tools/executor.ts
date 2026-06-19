// lib/scrapers/tools/executor.ts
// Executes a single scraper with retry, error handling, and result normalization.

import { ScrapeResult, Listing } from '@/types'
import { RegisteredScraper, ScraperArgs } from './registry'
import { CostGuard, CostGuardOptions } from './cost-guard'
import { CircuitBreakerRegistry, CircuitBreakerOptions } from './circuit-breaker'

export interface ExecutorOptions {
  maxRetries?: number
  retryDelayMs?: number
  timeoutMs?: number
  abortSignal?: AbortSignal
  dryRun?: boolean
  costGuard?: CostGuard
  costGuardOptions?: CostGuardOptions
  circuitBreaker?: CircuitBreakerRegistry
  circuitBreakerOptions?: CircuitBreakerOptions
}

export interface ExecutorResult {
  success: boolean
  listingsFound: number
  listingsSaved: number
  durationMs: number
  error?: string
  listings?: Listing[]
}

export class ScraperExecutor {
  async execute(
    scraper: RegisteredScraper,
    options: ExecutorOptions = {}
  ): Promise<ExecutorResult> {
    const { maxRetries = 2, retryDelayMs = 2000, timeoutMs = 300000, abortSignal, dryRun = false, costGuard, costGuardOptions, circuitBreaker, circuitBreakerOptions } = options
    const guard = costGuard || new CostGuard(costGuardOptions)
    const breaker = circuitBreaker || new CircuitBreakerRegistry(circuitBreakerOptions)
    const start = Date.now()
    let lastError: Error | null = null

    const budget = guard.check('time')
    if (!budget.allowed) {
      return {
        success: false,
        listingsFound: 0,
        listingsSaved: 0,
        durationMs: 0,
        error: budget.why,
      }
    }

    const circuit = breaker.canExecute(scraper.id)
    if (!circuit.allowed) {
      return {
        success: false,
        listingsFound: 0,
        listingsSaved: 0,
        durationMs: 0,
        error: circuit.reason,
      }
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (abortSignal?.aborted) {
        return {
          success: false,
          listingsFound: 0,
          listingsSaved: 0,
          durationMs: Date.now() - start,
          error: 'Aborted by user',
        }
      }

      try {
        if (dryRun) {
          await this.simulateScrape(scraper)
          return {
            success: true,
            listingsFound: scraper.estimatedListingsPerRun || Math.floor(Math.random() * 50),
            listingsSaved: scraper.estimatedListingsPerRun || Math.floor(Math.random() * 50),
            durationMs: Date.now() - start,
          }
        }

        const result = await this.runWithTimeout(scraper, timeoutMs, abortSignal)
        const durationMs = Date.now() - start

        const listingsFound = this.countResult(result)
        const remaining = guard.snapshot().remainingListings
        const cappedListings = Math.min(listingsFound, remaining)
        guard.trackListings(cappedListings)

        breaker.recordSuccess(scraper.id)
        return {
          success: true,
          listingsFound: cappedListings,
          listingsSaved: cappedListings,
          durationMs,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < maxRetries) {
          console.warn(`[Executor] ${scraper.id} attempt ${attempt + 1} failed, retrying in ${retryDelayMs}ms...`, lastError.message)
          await this.delay(retryDelayMs * (attempt + 1))
        }
      }
    }

    const durationMs = Date.now() - start
    breaker.recordFailure(scraper.id)
    return {
      success: false,
      listingsFound: 0,
      listingsSaved: 0,
      durationMs,
      error: lastError?.message || 'Unknown error',
    }
  }

  private async runWithTimeout(scraper: RegisteredScraper, timeoutMs: number, abortSignal?: AbortSignal): Promise<number | Listing[]> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Scraper ${scraper.id} timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      const onAbort = () => {
        clearTimeout(timeoutId)
        reject(new Error('Aborted'))
      }

      abortSignal?.addEventListener('abort', onAbort, { once: true })

      try {
        const args = scraper.args || {}
        const result = await scraper.fn(args)
        clearTimeout(timeoutId)
        resolve(result)
      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      } finally {
        abortSignal?.removeEventListener('abort', onAbort)
      }
    })
  }

  private async simulateScrape(scraper: RegisteredScraper): Promise<void> {
    const delay = Math.min(500 + Math.random() * 1000, scraper.averageDurationMs || 2000)
    await this.delay(delay)
  }

  private countResult(result: number | Listing[]): number {
    if (typeof result === 'number') return result
    if (Array.isArray(result)) return result.length
    return 0
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
