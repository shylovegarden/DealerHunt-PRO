export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ListingsService } from '@/lib/data/listings-service'


export async function GET(request: NextRequest) {
  try {
    const listingsService = new ListingsService()
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const filters: any = {}
    
    if (searchParams.get('source')) {
      filters.source = searchParams.get('source')!.split(',')
    }
    
    if (searchParams.get('sourceType')) {
      filters.sourceType = searchParams.get('sourceType')!.split(',')
    }
    
    if (searchParams.get('make')) {
      filters.make = searchParams.get('make')!.split(',')
    }
    
    if (searchParams.get('model')) {
      filters.model = searchParams.get('model')!.split(',')
    }
    
    if (searchParams.get('condition')) {
      filters.condition = searchParams.get('condition')!.split(',')
    }
    
    if (searchParams.get('location')) {
      filters.location = searchParams.get('location')
    }
    
    if (searchParams.get('sortBy')) {
      filters.sortBy = searchParams.get('sortBy') as any
    }
    
    if (searchParams.get('sortOrder')) {
      filters.sortOrder = searchParams.get('sortOrder') as any
    }
    
    if (searchParams.get('limit')) {
      filters.limit = parseInt(searchParams.get('limit')!)
    }
    
    if (searchParams.get('offset')) {
      filters.offset = parseInt(searchParams.get('offset')!)
    }
    
    // Handle search term
    const searchTerm = searchParams.get('search')
    if (searchTerm) {
      const result = await listingsService.searchListings(searchTerm, filters)
      return NextResponse.json(result)
    }
    
    // Handle hot deals
    const hot = searchParams.get('hot')
    if (hot === 'true') {
      const listings = await listingsService.getHotDeals(filters.limit || 10)
      return NextResponse.json({ listings, total: listings.length, hasMore: false })
    }
    
    // Get regular listings
    const result = await listingsService.getListings(filters)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in listings API:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch listings' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const listingsService = new ListingsService()
    const body = await request.json()
    const { action, listingId, alertThreshold, notes } = body

    // Get user from session (you'll need to implement session management)
    const userId = body.userId // This should come from auth session

    switch (action) {
      case 'addToWatchlist':
        await listingsService.addToWatchlist(userId, listingId, alertThreshold, notes)
        return NextResponse.json({ message: 'Added to watchlist' })
        
      case 'removeFromWatchlist':
        await listingsService.removeFromWatchlist(userId, listingId)
        return NextResponse.json({ message: 'Removed from watchlist' })
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in listings POST API:', error)
    return NextResponse.json({ 
      error: 'Failed to process request' 
    }, { status: 500 })
  }
}
