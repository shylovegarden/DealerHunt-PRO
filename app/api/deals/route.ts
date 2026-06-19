export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerComponentClient } from '@/lib/supabase'

export const revalidate = 0

export async function GET() {
  try {
    const supabase = createServerComponentClient()
    const { data: listings, error } = await supabase
      .from('listings')
      .select('*')
      .eq('active', true)
      .gt('profit_score', 0)
      .order('profit_score', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[Deals API] error:', error)
      return NextResponse.json({ deals: [], error: error.message }, { status: 500 })
    }

    const deals = (listings || []).map(l => ({
      id: l.id,
      title: l.title,
      year: l.year,
      make: l.make,
      model: l.model,
      price: l.ask_price,
      profit_estimate: l.profit_estimate,
      profit_score: l.profit_score,
      roi_pct: l.ask_price ? Math.round(((l.profit_estimate || 0) / l.ask_price) * 100) : 0,
      location: [l.location_city, l.location_state].filter(Boolean).join(', '),
      image_url: l.images?.[0],
      source: l.source,
      source_url: l.source_url,
      is_arbitrage_opportunity: l.is_arbitrage_opportunity,
    }))

    return NextResponse.json({ deals, count: deals.length })
  } catch (err) {
    console.error('[Deals API] exception:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ deals: [], error: message }, { status: 500 })
  }
}
