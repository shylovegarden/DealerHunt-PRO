import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const miles = parseInt(searchParams.get('miles') || '0', 10)
  const trailer = (searchParams.get('trailer') || 'open') as 'open' | 'enclosed'

  if (!miles || miles <= 0) {
    return NextResponse.json({ error: 'Miles required' }, { status: 400 })
  }

  const rates = { open: 0.78, enclosed: 1.28 }
  const minimums = { open: 350, enclosed: 600 }
  const quote = Math.max(minimums[trailer], Math.round(miles * rates[trailer]))

  return NextResponse.json({
    miles,
    trailer,
    quote,
    currency: 'USD',
    breakdown: {
      base: Math.round(miles * rates[trailer]),
      minimum: minimums[trailer],
      applied: quote,
    },
  })
}
