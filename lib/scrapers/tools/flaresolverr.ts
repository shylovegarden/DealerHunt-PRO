// lib/scrapers/tools/flaresolverr.ts
// Self-hosted Cloudflare/anti-bot bypass client. Falls back to direct fetch if not configured.

export interface FlareSolverrResponse {
  status: string
  message: string
  solution?: {
    url: string
    status: number
    cookies?: Array<{ name: string; value: string; domain: string }>
    userAgent?: string
    headers?: Record<string, string>
    response?: string
  }
  error?: string
}

export class FlareSolverrClient {
  private url: string

  constructor(url = process.env.FLARESOLVERR_URL) {
    this.url = url || ''
  }

  isConfigured(): boolean {
    return Boolean(this.url)
  }

  async fetch(url: string, options: { timeout?: number; method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {}): Promise<FlareSolverrResponse> {
    if (!this.isConfigured()) {
      throw new Error('FlareSolverr not configured. Set FLARESOLVERR_URL.')
    }

    const res = await fetch(`${this.url}/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url,
        timeout: options.timeout || 60000,
        maxTimeout: options.timeout || 60000,
      }),
    })

    if (!res.ok) {
      throw new Error(`FlareSolverr HTTP error: ${res.status}`)
    }

    return res.json() as Promise<FlareSolverrResponse>
  }

  async getHtml(url: string, timeout = 60000): Promise<string> {
    const result = await this.fetch(url, { timeout })
    if (result.status !== 'ok' || !result.solution?.response) {
      throw new Error(`FlareSolverr failed: ${result.message || result.error || 'unknown'}`)
    }
    return result.solution.response
  }
}

export async function fetchWithFlareSolverrFallback(url: string, options?: RequestInit, timeout = 60000): Promise<Response> {
  const client = new FlareSolverrClient()
  if (!client.isConfigured()) {
    return fetch(url, options)
  }

  try {
    const html = await client.getHtml(url, timeout)
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
  } catch (e) {
    // Fallback to direct fetch if FlareSolverr fails
    return fetch(url, options)
  }
}
