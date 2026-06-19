// Real dealers service with database integration
import { createClient } from '@supabase/supabase-js'

export interface Dealer {
  id: string
  name: string
  type: 'independent' | 'auction' | 'franchise' | 'salvage' | 'wholesale' | 'parts'
  location: {
    address: string
    city: string
    state: string
    zip: string
    coordinates: [number, number] // [lat, lon]
  }
  contact: {
    phone: string
    email?: string
    website?: string
  }
  inventory: {
    totalListings: number
    avgPrice: number
    priceRange: { min: number; max: number }
    popularMakes: string[]
    updateFrequency: string
  }
  reputation: {
    rating: number // 1-5
    reviews: number
    yearsInBusiness: number
    accreditations: string[]
  }
  business: {
    license: string
    established: Date
    employees: number
    specialties: string[]
    services: string[]
  }
  sourcing: {
    sources: string[]
    transportAvailable: boolean
    financingAvailable: boolean
    inspectionAvailable: boolean
  }
  metrics: {
    dealScore: number // 0-100
    profitPotential: number
    reliabilityScore: number
    responsivenessScore: number
  }
  lastUpdated: Date
}

export interface DealerSearchCriteria {
  states?: string[]
  dealerTypes?: Dealer['type'][]
  priceRange?: { min: number; max: number }
  makes?: string[]
  services?: string[]
  minRating?: number
  maxDistance?: number // miles from coordinates
  centerCoordinates?: [number, number]
  hasInventory?: boolean
  sortBy?: 'score' | 'price' | 'distance' | 'rating'
  limit?: number
}

export class DealersService {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
  }

  // Search dealers with filters
  async searchDealers(criteria: DealerSearchCriteria = {}): Promise<Dealer[]> {
    let query = this.supabase
      .from('dealers')
      .select('*')

    // Apply filters
    if (criteria.states && criteria.states.length > 0) {
      query = query.in('state', criteria.states)
    }

    if (criteria.dealerTypes && criteria.dealerTypes.length > 0) {
      query = query.in('type', criteria.dealerTypes)
    }

    if (criteria.priceRange) {
      query = query.gte('avg_price', criteria.priceRange.min).lte('avg_price', criteria.priceRange.max)
    }

    if (criteria.makes && criteria.makes.length > 0) {
      query = query.contains('popular_makes', criteria.makes)
    }

    if (criteria.services && criteria.services.length > 0) {
      query = query.contains('services', criteria.services)
    }

    if (criteria.minRating) {
      query = query.gte('rating', criteria.minRating)
    }

    // Apply sorting
    if (criteria.sortBy) {
      switch (criteria.sortBy) {
        case 'score':
          query = query.order('deal_score', { ascending: false })
          break
        case 'price':
          query = query.order('avg_price', { ascending: true })
          break
        case 'rating':
          query = query.order('rating', { ascending: false })
          break
        default:
          query = query.order('deal_score', { ascending: false })
      }
    } else {
      query = query.order('deal_score', { ascending: false })
    }

    // Apply limit
    if (criteria.limit) {
      query = query.limit(criteria.limit)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to search dealers: ${error.message}`)
    }

    const dealers = (data || []).map(this.mapDbToDealer)

    // Filter by distance if coordinates provided
    if (criteria.centerCoordinates && criteria.maxDistance) {
      return this.filterByDistance(dealers, criteria.centerCoordinates, criteria.maxDistance)
    }

    return dealers
  }

  // Get dealer by ID
  async getDealerById(id: string): Promise<Dealer | null> {
    const { data, error } = await this.supabase
      .from('dealers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch dealer: ${error.message}`)
    }

    return this.mapDbToDealer(data)
  }

  // Get dealers near coordinates
  async getDealersNearCoordinates(
    coordinates: [number, number],
    radius: number = 100, // miles
    limit: number = 20
  ): Promise<Dealer[]> {
    // Use PostGIS to find dealers within radius
    const { data, error } = await this.supabase
      .from('dealers')
      .select('*')
      .select(`
        *,
        distance = ST_Distance(coordinates, ST_MakePoint(${coordinates[1]}, ${coordinates[0]})::geography) / 1609.34
      `)
      .lte('distance', radius)
      .order('distance', { ascending: true })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to find nearby dealers: ${error.message}`)
    }

    return (data || []).map(this.mapDbToDealer)
  }

  // Get top dealers by profit potential
  async getTopDealersByProfit(limit: number = 10): Promise<Dealer[]> {
    const { data, error } = await this.supabase
      .from('dealers')
      .select('*')
      .order('profit_potential', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch top dealers: ${error.message}`)
    }

    return (data || []).map(this.mapDbToDealer)
  }

  // Get dealer statistics by state
  async getStateDealerStats(state: string): Promise<{
    totalDealers: number
    byType: Record<Dealer['type'], number>
    avgPrice: number
    avgRating: number
    topMakes: string[]
  }> {
    const { data, error } = await this.supabase
      .from('dealers')
      .select('type, avg_price, rating, popular_makes')
      .eq('state', state)

    if (error) {
      throw new Error(`Failed to fetch state stats: ${error.message}`)
    }

    const dealers = data || []
    const totalDealers = dealers.length

    // Count by type
    const byType: Record<Dealer['type'], number> = {
      independent: 0,
      auction: 0,
      franchise: 0,
      salvage: 0,
      wholesale: 0,
      parts: 0
    }

    dealers.forEach((dealer: any) => {
      if (dealer.type in byType) {
        byType[dealer.type as Dealer['type']]++
      }
    })

    // Calculate averages
    const avgPrice = dealers.length > 0
      ? dealers.reduce((sum: number, dealer: any) => sum + parseFloat(dealer.avg_price), 0) / dealers.length
      : 0

    const avgRating = dealers.length > 0
      ? dealers.reduce((sum: number, dealer: any) => sum + parseFloat(dealer.rating), 0) / dealers.length
      : 0

    // Get top makes
    const makeCounts: Record<string, number> = {}
    dealers.forEach((dealer: any) => {
      if (dealer.popular_makes) {
        dealer.popular_makes.forEach((make: string) => {
          makeCounts[make] = (makeCounts[make] || 0) + 1
        })
      }
    })

    const topMakes = Object.entries(makeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([make]) => make)

    return {
      totalDealers,
      byType,
      avgPrice: Math.round(avgPrice),
      avgRating: Math.round(avgRating * 10) / 10,
      topMakes
    }
  }

  // Get dealer recommendations based on user preferences
  async generateDealerRecommendations(
    userPreferences: {
      preferredMakes: string[]
      priceRange: { min: number; max: number }
      location: { state: string; city?: string }
      services: string[]
    }
  ): Promise<{
    recommended: Dealer[]
    reasoning: string[]
  }> {
    const criteria: DealerSearchCriteria = {
      states: [userPreferences.location.state],
      makes: userPreferences.preferredMakes,
      priceRange: userPreferences.priceRange,
      services: userPreferences.services,
      sortBy: 'score',
      limit: 10
    }

    const recommended = await this.searchDealers(criteria)
    const reasoning: string[] = []

    if (recommended.length > 0) {
      reasoning.push(`Found ${recommended.length} dealers matching your criteria in ${userPreferences.location.state}`)
      
      if (userPreferences.preferredMakes.length > 0) {
        reasoning.push(`Filtered for dealers specializing in ${userPreferences.preferredMakes.join(', ')}`)
      }
      
      if (userPreferences.services.length > 0) {
        reasoning.push(`Prioritized dealers offering ${userPreferences.services.join(', ')}`)
      }
    } else {
      reasoning.push('No exact matches found - showing nearest alternatives')
      // Fallback to nearest dealers
      criteria.states = undefined
      criteria.makes = undefined
      criteria.limit = 5
      recommended.push(...(await this.searchDealers(criteria)))
    }

    return { recommended, reasoning }
  }

  // Update dealer information
  async updateDealer(id: string, updates: Partial<Dealer>): Promise<Dealer> {
    const dbUpdates = this.mapDealerToDb(updates)
    
    const { data, error } = await this.supabase
      .from('dealers')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update dealer: ${error.message}`)
    }

    return this.mapDbToDealer(data)
  }

  // Add dealer to database
  async addDealer(dealer: Omit<Dealer, 'id' | 'lastUpdated'>): Promise<Dealer> {
    const dbDealer = this.mapDealerToDb(dealer)
    
    const { data, error } = await this.supabase
      .from('dealers')
      .insert(dbDealer)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add dealer: ${error.message}`)
    }

    return this.mapDbToDealer(data)
  }

  // Get dealer statistics
  async getDealerStatistics(): Promise<{
    totalDealers: number
    byType: Record<Dealer['type'], number>
    byState: Record<string, number>
    avgRating: number
    topStates: Array<{ state: string; count: number }>
  }> {
    const { data, error } = await this.supabase
      .from('dealers')
      .select('type, state, rating')

    if (error) {
      throw new Error(`Failed to fetch dealer statistics: ${error.message}`)
    }

    const dealers = data || []
    const totalDealers = dealers.length

    // Count by type
    const byType: Record<Dealer['type'], number> = {
      independent: 0,
      auction: 0,
      franchise: 0,
      salvage: 0,
      wholesale: 0,
      parts: 0
    }

    // Count by state
    const byState: Record<string, number> = {}

    dealers.forEach((dealer: any) => {
      if (dealer.type in byType) {
        byType[dealer.type as Dealer['type']]++
      }
      
      byState[dealer.state] = (byState[dealer.state] || 0) + 1
    })

    // Calculate average rating
    const avgRating = dealers.length > 0
      ? dealers.reduce((sum: number, dealer: any) => sum + parseFloat(dealer.rating), 0) / dealers.length
      : 0

    // Get top states
    const topStates = Object.entries(byState)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([state, count]) => ({ state, count }))

    return {
      totalDealers,
      byType,
      byState,
      avgRating: Math.round(avgRating * 10) / 10,
      topStates
    }
  }

  // Filter dealers by distance
  private filterByDistance(
    dealers: Dealer[],
    centerCoordinates: [number, number],
    maxDistance: number
  ): Dealer[] {
    return dealers.filter(dealer => {
      const distance = this.calculateDistance(centerCoordinates, dealer.location.coordinates)
      return distance <= maxDistance
    }).sort((a, b) => {
      const distanceA = this.calculateDistance(centerCoordinates, a.location.coordinates)
      const distanceB = this.calculateDistance(centerCoordinates, b.location.coordinates)
      return distanceA - distanceB
    })
  }

  // Calculate distance between two coordinates (Haversine formula)
  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lat1, lon1] = coord1
    const [lat2, lon2] = coord2

    const R = 3959 // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  // Map database record to Dealer interface
  private mapDbToDealer(dbRecord: any): Dealer {
    return {
      id: dbRecord.id,
      name: dbRecord.name,
      type: dbRecord.type,
      location: {
        address: dbRecord.address,
        city: dbRecord.city,
        state: dbRecord.state,
        zip: dbRecord.zip,
        coordinates: [dbRecord.coordinates.y, dbRecord.coordinates.x] // PostGIS stores as (lon, lat)
      },
      contact: {
        phone: dbRecord.phone,
        email: dbRecord.email,
        website: dbRecord.website
      },
      inventory: {
        totalListings: dbRecord.total_listings || 0,
        avgPrice: parseFloat(dbRecord.avg_price) || 0,
        priceRange: {
          min: dbRecord.price_range ? parseFloat(dbRecord.price_range[0]) : 0,
          max: dbRecord.price_range ? parseFloat(dbRecord.price_range[1]) : 0
        },
        popularMakes: dbRecord.popular_makes || [],
        updateFrequency: dbRecord.update_frequency || 'daily'
      },
      reputation: {
        rating: parseFloat(dbRecord.rating) || 0,
        reviews: dbRecord.reviews || 0,
        yearsInBusiness: dbRecord.years_in_business || 0,
        accreditations: dbRecord.accreditations || []
      },
      business: {
        license: dbRecord.license || '',
        established: new Date(dbRecord.established),
        employees: dbRecord.employees || 0,
        specialties: dbRecord.specialties || [],
        services: dbRecord.services || []
      },
      sourcing: {
        sources: dbRecord.sources || [],
        transportAvailable: dbRecord.transport_available || false,
        financingAvailable: dbRecord.financing_available || false,
        inspectionAvailable: dbRecord.inspection_available || false
      },
      metrics: {
        dealScore: parseFloat(dbRecord.deal_score) || 0,
        profitPotential: parseFloat(dbRecord.profit_potential) || 0,
        reliabilityScore: parseFloat(dbRecord.reliability_score) || 0,
        responsivenessScore: parseFloat(dbRecord.responsiveness_score) || 0
      },
      lastUpdated: new Date(dbRecord.last_updated)
    }
  }

  // Map Dealer interface to database record
  private mapDealerToDb(dealer: Partial<Dealer>): any {
    return {
      name: dealer.name,
      type: dealer.type,
      address: dealer.location?.address,
      city: dealer.location?.city,
      state: dealer.location?.state,
      zip: dealer.location?.zip,
      coordinates: dealer.location?.coordinates 
        ? `POINT(${dealer.location.coordinates[1]} ${dealer.location.coordinates[0]})`
        : undefined,
      phone: dealer.contact?.phone,
      email: dealer.contact?.email,
      website: dealer.contact?.website,
      total_listings: dealer.inventory?.totalListings,
      avg_price: dealer.inventory?.avgPrice,
      price_range: dealer.inventory?.priceRange 
        ? `[${dealer.inventory.priceRange.min}, ${dealer.inventory.priceRange.max}]`
        : undefined,
      popular_makes: dealer.inventory?.popularMakes,
      update_frequency: dealer.inventory?.updateFrequency,
      rating: dealer.reputation?.rating,
      reviews: dealer.reputation?.reviews,
      years_in_business: dealer.reputation?.yearsInBusiness,
      accreditations: dealer.reputation?.accreditations,
      license: dealer.business?.license,
      established: dealer.business?.established,
      employees: dealer.business?.employees,
      specialties: dealer.business?.specialties,
      services: dealer.business?.services,
      sources: dealer.sourcing?.sources,
      transport_available: dealer.sourcing?.transportAvailable,
      financing_available: dealer.sourcing?.financingAvailable,
      inspection_available: dealer.sourcing?.inspectionAvailable,
      deal_score: dealer.metrics?.dealScore,
      profit_potential: dealer.metrics?.profitPotential,
      reliability_score: dealer.metrics?.reliabilityScore,
      responsiveness_score: dealer.metrics?.responsivenessScore,
      last_updated: new Date()
    }
  }
}
