import { NextRequest, NextResponse } from 'next/server'
import { ScraperAlertService } from '@/lib/scrapers/tools/alerts'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = new ScraperAlertService({
      resendApiKey: process.env.RESEND_API_KEY,
    })

    const result = await service.processAlerts()

    return NextResponse.json({
      message: `Processed ${result.processed} pending alerts, sent ${result.emailsSent} emails`,
      ...result,
    })
  } catch (error) {
    console.error('Alert processing error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
