// lib/scrapers/tools/circuit-breaker.ts
// Per-source circuit breaker so failing scrapers fail fast instead of burning retries/proxies/time.

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  failureThreshold?: number
  resetTimeoutMs?: number
  halfOpenMaxAttempts?: number
}

export interface CircuitBreakerRecord {
  state: CircuitState
  failures: number
  successes: number
  lastFailureAt?: Date
  lastSuccessAt?: Date
  openedAt?: Date
  halfOpenAttempts: number
}

export class CircuitBreakerRegistry {
  private records: Map<string, CircuitBreakerRecord> = new Map()
  private options: Required<CircuitBreakerOptions>

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeoutMs: options.resetTimeoutMs || 60 * 1000,
      halfOpenMaxAttempts: options.halfOpenMaxAttempts || 1,
      ...options,
    }
  }

  get(id: string): CircuitBreakerRecord {
    if (!this.records.has(id)) {
      this.records.set(id, {
        state: 'closed',
        failures: 0,
        successes: 0,
        halfOpenAttempts: 0,
      })
    }
    return this.records.get(id)!
  }

  canExecute(id: string): { allowed: boolean; state: CircuitState; reason?: string } {
    const record = this.get(id)

    if (record.state === 'open') {
      if (record.openedAt && Date.now() - record.openedAt.getTime() >= this.options.resetTimeoutMs) {
        record.state = 'half-open'
        record.halfOpenAttempts = 0
        return { allowed: true, state: 'half-open' }
      }
      return { allowed: false, state: 'open', reason: `Circuit breaker OPEN for ${id}` }
    }

    if (record.state === 'half-open' && record.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
      return { allowed: false, state: 'half-open', reason: `Circuit breaker half-open limit reached for ${id}` }
    }

    return { allowed: true, state: record.state }
  }

  recordSuccess(id: string): void {
    const record = this.get(id)
    record.successes += 1
    record.lastSuccessAt = new Date()

    if (record.state === 'half-open') {
      record.halfOpenAttempts += 1
      if (record.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
        this.closeCircuit(id)
      }
    }
  }

  recordFailure(id: string): void {
    const record = this.get(id)
    record.failures += 1
    record.lastFailureAt = new Date()

    if (record.state === 'half-open') {
      this.openCircuit(id)
      return
    }

    if (record.state === 'closed' && record.failures >= this.options.failureThreshold) {
      this.openCircuit(id)
    }
  }

  private openCircuit(id: string): void {
    const record = this.get(id)
    record.state = 'open'
    record.openedAt = new Date()
    console.warn(`[CircuitBreaker] OPENED for ${id} after ${record.failures} failures`)
  }

  private closeCircuit(id: string): void {
    const record = this.get(id)
    record.state = 'closed'
    record.failures = 0
    record.halfOpenAttempts = 0
    record.openedAt = undefined
    console.log(`[CircuitBreaker] CLOSED for ${id}`)
  }

  reset(id: string): void {
    this.records.delete(id)
  }

  getAll(): Record<string, CircuitBreakerRecord> {
    return Object.fromEntries(this.records)
  }
}
