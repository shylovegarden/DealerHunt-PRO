export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { DailyRefreshManager } from '@/lib/scrapers/runner'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')
  const secret = searchParams.get('secret')

  // Verify cron secret
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const manager = new DailyRefreshManager()
  
  try {
    const results = await manager.runDailyRefresh(source || undefined)
    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Scrape error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Manual trigger for testing
  return GET(request)
}
