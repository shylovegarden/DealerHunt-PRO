export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ListingsService, ListingFilters } from '@/lib/data/listings-service'
import { isSupabaseConfigured } from '@/lib/supabase'

function parseFilters(searchParams: URLSearchParams): ListingFilters {
  return {
    source: searchParams.get('source')?.split(',').filter(Boolean),
    make: searchParams.get('make')?.split(',').filter(Boolean),
    condition: searchParams.get('condition')?.split(',').filter(Boolean),
    location: searchParams.get('location') || undefined,
    minProfit: searchParams.get('minProfit') ? parseInt(searchParams.get('minProfit')!, 10) : undefined,
    minScore: searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!, 10) : undefined,
    sortBy: (searchParams.get('sortBy') as ListingFilters['sortBy']) || undefined,
    sortOrder: (searchParams.get('sortOrder') as ListingFilters['sortOrder']) || undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
  }
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local' }, { status: 503 })
  }

  try {
    const listingsService = new ListingsService()
    const { searchParams } = new URL(request.url)

    const searchTerm = searchParams.get('search')
    if (searchTerm) {
      const result = await listingsService.searchListings(searchTerm, parseFilters(searchParams))
      return NextResponse.json(result)
    }

    const hot = searchParams.get('hot')
    if (hot === 'true') {
      const listings = await listingsService.getHotDeals(parseInt(searchParams.get('limit') || '10', 10))
      return NextResponse.json({ listings, total: listings.length, hasMore: false })
    }

    const result = await listingsService.getListings(parseFilters(searchParams))
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in listings API:', error)
    return NextResponse.json({
      error: 'Failed to fetch listings',
    }, { status: 500 })
  }
}
