// Real listings service with database integration
import { createClient } from '@supabase/supabase-js'

export interface Listing {
  id: string
  source: string
  sourceType: 'auction' | 'marketplace' | 'dealer' | 'parts'
  title: string
  price: number
  currency: string
  year?: number
  make?: string
  model?: string
  vin?: string
  mileage?: number
  location?: string
  description?: string
  images: string[]
  auctionEnd?: Date
  bidCount?: number
  seller?: string
  sellerType?: 'dealer' | 'auction' | 'private'
  condition?: 'clean' | 'salvage' | 'rebuilt' | 'parts'
  transportCost?: number
  repairEstimate?: number
  profitScore?: number
  scrapedAt: Date
  url?: string
  metadata: Record<string, any>
}

export interface ListingFilters {
  source?: string[]
  sourceType?: string[]
  make?: string[]
  model?: string[]
  yearRange?: { min: number; max: number }
  priceRange?: { min: number; max: number }
  mileageRange?: { min: number; max: number }
  condition?: string[]
  location?: string
  sortBy?: 'price' | 'year' | 'mileage' | 'profitScore' | 'scrapedAt'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export class ListingsService {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
  }

  // Get listings with filters
  async getListings(filters: ListingFilters = {}): Promise<{
    listings: Listing[]
    total: number
    hasMore: boolean
  }> {
    let query = this.supabase
      .from('listings')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters.source && filters.source.length > 0) {
      query = query.in('source', filters.source)
    }

    if (filters.sourceType && filters.sourceType.length > 0) {
      query = query.in('source_type', filters.sourceType)
    }

    if (filters.make && filters.make.length > 0) {
      query = query.in('make', filters.make)
    }

    if (filters.model && filters.model.length > 0) {
      query = query.in('model', filters.model)
    }

    if (filters.yearRange) {
      query = query.gte('year', filters.yearRange.min).lte('year', filters.yearRange.max)
    }

    if (filters.priceRange) {
      query = query.gte('price', filters.priceRange.min).lte('price', filters.priceRange.max)
    }

    if (filters.mileageRange) {
      query = query.gte('mileage', filters.mileageRange.min).lte('mileage', filters.mileageRange.max)
    }

    if (filters.condition && filters.condition.length > 0) {
      query = query.in('condition', filters.condition)
    }

    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`)
    }

    // Apply sorting
    if (filters.sortBy) {
      const order = filters.sortOrder || 'desc'
      query = query.order(filters.sortBy, { ascending: order === 'asc' })
    } else {
      query = query.order('scraped_at', { ascending: false })
    }

    // Apply pagination
    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch listings: ${error.message}`)
    }

    const listings = (data || []).map(this.mapDbToListing)
    const total = count || 0
    const limit = filters.limit || 20
    const offset = filters.offset || 0
    const hasMore = offset + listings.length < total

    return { listings, total, hasMore }
  }

  // Get listing by ID
  async getListingById(id: string): Promise<Listing | null> {
    const { data, error } = await this.supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch listing: ${error.message}`)
    }

    return this.mapDbToListing(data)
  }

  // Search listings by text
  async searchListings(searchTerm: string, filters: ListingFilters = {}): Promise<{
    listings: Listing[]
    total: number
    hasMore: boolean
  }> {
    let query = this.supabase
      .from('listings')
      .select('*', { count: 'exact' })
      .or(`title.ilike.%${searchTerm}%,make.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)

    // Apply additional filters
    if (filters.source && filters.source.length > 0) {
      query = query.in('source', filters.source)
    }

    if (filters.priceRange) {
      query = query.gte('price', filters.priceRange.min).lte('price', filters.priceRange.max)
    }

    // Apply sorting and pagination
    if (filters.sortBy) {
      const order = filters.sortOrder || 'desc'
      query = query.order(filters.sortBy, { ascending: order === 'asc' })
    } else {
      query = query.order('scraped_at', { ascending: false })
    }

    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to search listings: ${error.message}`)
    }

    const listings = (data || []).map(this.mapDbToListing)
    const total = count || 0
    const limit = filters.limit || 20
    const hasMore = listings.length < total

    return { listings, total, hasMore }
  }

  // Get hot deals (high profit score)
  async getHotDeals(limit: number = 10): Promise<Listing[]> {
    const { data, error } = await this.supabase
      .from('listings')
      .select('*')
      .gte('profit_score', 70)
      .order('profit_score', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch hot deals: ${error.message}`)
    }

    return (data || []).map(this.mapDbToListing)
  }

  // Get listings by source
  async getListingsBySource(source: string, limit: number = 20): Promise<Listing[]> {
    const { data, error } = await this.supabase
      .from('listings')
      .select('*')
      .eq('source', source)
      .order('scraped_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch listings by source: ${error.message}`)
    }

    return (data || []).map(this.mapDbToListing)
  }

  // Add listing to watchlist
  async addToWatchlist(userId: string, listingId: string, alertThreshold?: number, notes?: string): Promise<void> {
    const { error } = await this.supabase
      .from('watchlist')
      .upsert({
        user_id: userId,
        listing_id: listingId,
        alert_threshold: alertThreshold,
        notes
      }, {
        onConflict: 'user_id,listing_id'
      })

    if (error) {
      throw new Error(`Failed to add to watchlist: ${error.message}`)
    }
  }

  // Remove from watchlist
  async removeFromWatchlist(userId: string, listingId: string): Promise<void> {
    const { error } = await this.supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listingId)

    if (error) {
      throw new Error(`Failed to remove from watchlist: ${error.message}`)
    }
  }

  // Get user's watchlist
  async getWatchlist(userId: string, limit: number = 50): Promise<Listing[]> {
    const { data, error } = await this.supabase
      .from('watchlist')
      .select(`
        listing_id,
        listings (
          *
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch watchlist: ${error.message}`)
    }

    return (data || []).map((item: any) => this.mapDbToListing(item.listings))
  }

  // Get price history for a listing
  async getPriceHistory(listingId: string): Promise<Array<{
    date: string
    price: number
    source: string
  }>> {
    const { data, error } = await this.supabase
      .from('price_history')
      .select('*')
      .eq('listing_id', listingId)
      .order('date', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch price history: ${error.message}`)
    }

    return (data || []).map((item: any) => ({
      date: item.date,
      price: parseFloat(item.price),
      source: item.source
    }))
  }

  // Get available sources
  async getAvailableSources(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('listings')
      .select('source')
      .not('source', 'is', null)

    if (error) {
      throw new Error(`Failed to fetch sources: ${error.message}`)
    }

    const sources: string[] = []
    for (const item of data || []) {
      const s = String(item.source)
      if (!sources.includes(s)) sources.push(s)
    }
    return sources.sort()
  }

  // Get available makes
  async getAvailableMakes(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('listings')
      .select('make')
      .not('make', 'is', null)

    if (error) {
      throw new Error(`Failed to fetch makes: ${error.message}`)
    }

    const makes: string[] = []
    for (const item of data || []) {
      const m = String(item.make)
      if (!makes.includes(m)) makes.push(m)
    }
    return makes.sort()
  }

  // Get statistics
  async getStatistics(): Promise<{
    totalListings: number
    avgPrice: number
    topSources: Array<{ source: string; count: number }>
    topMakes: Array<{ make: string; count: number }>
    recentCount: number
  }> {
    // Get total listings and average price
    const { data: statsData, error: statsError } = await this.supabase
      .from('listings')
      .select('price, source, make, scraped_at')

    if (statsError) {
      throw new Error(`Failed to fetch statistics: ${statsError.message}`)
    }

    const listings = statsData || []
    const totalListings = listings.length
    const avgPrice = listings.length > 0 
      ? listings.reduce((sum: number, item: any) => sum + parseFloat(item.price), 0) / listings.length
      : 0

    // Get top sources
    const sourceCounts: Record<string, number> = {}
    listings.forEach((item: any) => {
      sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1
    })
    const topSources = Object.entries(sourceCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([source, count]) => ({ source, count }))

    // Get top makes
    const makeCounts: Record<string, number> = {}
    listings.forEach((item: any) => {
      if (item.make) {
        makeCounts[item.make] = (makeCounts[item.make] || 0) + 1
      }
    })
    const topMakes = Object.entries(makeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([make, count]) => ({ make, count }))

    // Get recent listings (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentCount = listings.filter((item: any) => 
      new Date(item.scraped_at) > oneDayAgo
    ).length

    return {
      totalListings,
      avgPrice: Math.round(avgPrice),
      topSources,
      topMakes,
      recentCount
    }
  }

  // Map database record to Listing interface
  private mapDbToListing(dbRecord: any): Listing {
    return {
      id: dbRecord.id,
      source: dbRecord.source,
      sourceType: dbRecord.source_type,
      title: dbRecord.title,
      price: parseFloat(dbRecord.price),
      currency: dbRecord.currency,
      year: dbRecord.year,
      make: dbRecord.make,
      model: dbRecord.model,
      vin: dbRecord.vin,
      mileage: dbRecord.mileage,
      location: dbRecord.location,
      description: dbRecord.description,
      images: dbRecord.images || [],
      auctionEnd: dbRecord.auction_end ? new Date(dbRecord.auction_end) : undefined,
      bidCount: dbRecord.bid_count,
      seller: dbRecord.seller,
      sellerType: dbRecord.seller_type,
      condition: dbRecord.condition,
      transportCost: dbRecord.transport_cost ? parseFloat(dbRecord.transport_cost) : undefined,
      repairEstimate: dbRecord.repair_estimate ? parseFloat(dbRecord.repair_estimate) : undefined,
      profitScore: dbRecord.profit_score ? parseFloat(dbRecord.profit_score) : undefined,
      scrapedAt: new Date(dbRecord.scraped_at),
      url: dbRecord.url,
      metadata: dbRecord.metadata || {}
    }
  }
}
