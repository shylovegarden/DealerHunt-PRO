// app/api/scrape/run/route.ts
// API endpoint to trigger scraper orchestration runs.

import { NextRequest, NextResponse } from 'next/server'
import { runScrapers, OrchestratorType } from '@/lib/scrapers/runner'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const orchestrator: OrchestratorType = body.orchestrator || 'concurrent'
    const sourceIds: string[] | undefined = body.sourceIds
    const concurrency: number = body.concurrency || 3
    const dryRun: boolean = body.dryRun || false

    const results = await runScrapers({
      orchestrator,
      sourceIds,
      concurrency,
      dryRun,
    })

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalDeals: results.reduce((sum, r) => sum + r.dealsFound, 0),
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      results,
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Scraper run failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scraper run failed' },
      { status: 500 }
    )
  }
}
