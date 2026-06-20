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
    return NextResponse.json({ vin: cleaned, ...decoded })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
