import { NextRequest, NextResponse } from 'next/server'
import { decodeVIN } from '@/lib/vin-decoder'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params
  const cleaned = vin?.toUpperCase().trim()

  if (!cleaned || cleaned.length !== 17) {
    return NextResponse.json({ error: 'VIN must be 17 characters' }, { status: 400 })
  }

  try {
    const decoded = await decodeVIN(cleaned)
    if (!decoded) {
      return NextResponse.json({ error: 'Unable to decode VIN' }, { status: 404 })
    }

    // Mock market value when no MarketCheck key is configured.
    // Uses a deterministic formula based on VIN characters to keep the same VIN stable.
    const seed = cleaned.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const baseValue = 15000 + (seed % 25000)
    const wholesale = Math.round(baseValue * 0.82)
    const retail = Math.round(baseValue * 1.08)

    return NextResponse.json({
      vin: cleaned,
      vehicle: decoded,
      market: {
        wholesale,
        retail,
        currency: 'USD',
        source: 'mock_cache',
      },
      note: 'Market values are mocked until MarketCheck API key is configured.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
