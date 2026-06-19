// lib/scrapers/tools/cost-guard.ts
// Enforce spending/time budgets per run and per source to avoid runaway cloud costs.

export interface CostGuardOptions {
  maxDurationMs?: number
  maxListingsPerRun?: number
  maxPagesPerRun?: number
  maxConcurrentBrowsers?: number
  estimateCostPerListing?: number
  estimateCostPerBrowserPage?: number
}

export interface BudgetSnapshot {
  elapsedMs: number
  listingsSoFar: number
  pagesSoFar: number
  browsersSoFar: number
  estimatedCostCents: number
  remainingDurationMs: number
  remainingListings: number
  remainingPages: number
}

export class CostGuard {
  private startMs: number
  private listings = 0
  private pages = 0
  private browsers = 0
  private options: Required<CostGuardOptions>

  constructor(options: CostGuardOptions = {}) {
    this.startMs = Date.now()
    this.options = {
      maxDurationMs: 10 * 60 * 1000, // 10 min
      maxListingsPerRun: 5000,
      maxPagesPerRun: 200,
      maxConcurrentBrowsers: 3,
      estimateCostPerListing: 0, // cents
      estimateCostPerBrowserPage: 5, // ~$0.05 per browser page on cloud
      ...options,
    }
  }

  snapshot(): BudgetSnapshot {
    const elapsedMs = Date.now() - this.startMs
    const estimatedCostCents =
      this.listings * this.options.estimateCostPerListing +
      this.pages * this.options.estimateCostPerBrowserPage

    return {
      elapsedMs,
      listingsSoFar: this.listings,
      pagesSoFar: this.pages,
      browsersSoFar: this.browsers,
      estimatedCostCents,
      remainingDurationMs: Math.max(0, this.options.maxDurationMs - elapsedMs),
      remainingListings: Math.max(0, this.options.maxListingsPerRun - this.listings),
      remainingPages: Math.max(0, this.options.maxPagesPerRun - this.pages),
    }
  }

  check(reason: 'listing' | 'page' | 'browser' | 'time'): { allowed: boolean; why?: string } {
    const s = this.snapshot()

    if (s.remainingDurationMs <= 0) {
      return { allowed: false, why: `Run exceeded max duration ${this.options.maxDurationMs}ms` }
    }
    if (reason === 'listing' && s.remainingListings <= 0) {
      return { allowed: false, why: `Run exceeded max listings ${this.options.maxListingsPerRun}` }
    }
    if (reason === 'page' && s.remainingPages <= 0) {
      return { allowed: false, why: `Run exceeded max pages ${this.options.maxPagesPerRun}` }
    }
    if (reason === 'browser' && s.browsersSoFar >= this.options.maxConcurrentBrowsers) {
      return { allowed: false, why: `Run exceeded max browsers ${this.options.maxConcurrentBrowsers}` }
    }

    return { allowed: true }
  }

  trackListings(count: number): void {
    this.listings += count
  }

  trackPages(count: number): void {
    this.pages += count
  }

  trackBrowser(): void {
    this.browsers += 1
  }

  releaseBrowser(): void {
    this.browsers = Math.max(0, this.browsers - 1)
  }
}
