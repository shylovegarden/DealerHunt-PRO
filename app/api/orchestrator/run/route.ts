export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ScraperScheduler } from '@/lib/scrapers/scheduler'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Verify cron secret to prevent unauthorized triggers
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Build scheduler per request to avoid shared state in serverless environment
    const scheduler = new ScraperScheduler({
      mode: 'concurrent',
      concurrency: 3,
      dryRun: false,
    })

    const result = await scheduler.runOnce()

    return NextResponse.json({
      success: result.started,
      sourceIds: result.sourceIds,
      mode: result.mode,
      nextRunAt: result.nextRunAt?.toISOString(),
      reason: result.reason,
    })
  } catch (error) {
    console.error('[API/Orchestrator] Run failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Allow manual POST triggers from the dashboard
  return GET(request)
}
