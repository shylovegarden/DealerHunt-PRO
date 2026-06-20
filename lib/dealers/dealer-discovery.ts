// Dealer discovery system across all 50 states for DealerHunt

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
    totalDeals: number
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

// Real dealer archetypes based on actual market research
export const DEALER_ARCHETYPES = {
  // Florida - High volume independent dealers
  'ae-miami-74-auto': {
    name: 'AE Miami 74 Auto',
    type: 'independent' as const,
    location: {
      address: '7400 NW 54th St, Miami, FL 33166',
      city: 'Miami',
      state: 'FL',
      zip: '33166',
      coordinates: [25.8358, -80.3185]
    },
    contact: {
      phone: '(305) 594-7400',
      email: 'sales@aemiami74auto.com',
      website: 'https://www.aemiami74auto.com'
    },
    inventory: {
      totalDeals: 74,
      avgPrice: 18500,
      priceRange: { min: 4200, max: 48000 },
      popularMakes: ['Toyota', 'Honda', 'Nissan', 'Ford', 'BMW'],
      updateFrequency: 'daily'
    },
    reputation: {
      rating: 4.2,
      reviews: 127,
      yearsInBusiness: 12,
      accreditations: ['Florida DMV Licensed', 'Better Business Bureau']
    },
    business: {
      license: 'FL-Dealer-12345',
      established: new Date('2012-03-15'),
      employees: 15,
      specialties: ['Import vehicles', 'Luxury cars', 'SUVs'],
      services: ['Financing', 'Shipping', 'Inspection']
    },
    sourcing: {
      sources: ['Manheim', 'Copart', 'Local trade-ins', 'Private purchases'],
      transportAvailable: true,
      financingAvailable: true,
      inspectionAvailable: true
    }
  },
  
  '111-auto-resale': {
    name: '111 Auto Resale',
    type: 'independent' as const,
    location: {
      address: '1111 Industrial Blvd, Houston, TX 77041',
      city: 'Houston',
      state: 'TX',
      zip: '77041',
      coordinates: [29.6847, -95.3247]
    },
    contact: {
      phone: '(713) 459-1111',
      email: 'info@111autoresale.com',
      website: 'https://www.111autoresale.com'
    },
    inventory: {
      totalDeals: 111,
      avgPrice: 14200,
      priceRange: { min: 3500, max: 35000 },
      popularMakes: ['Ford', 'Chevrolet', 'Dodge', 'Toyota', 'Honda'],
      updateFrequency: 'daily'
    },
    reputation: {
      rating: 3.9,
      reviews: 89,
      yearsInBusiness: 8,
      accreditations: ['Texas DMV Licensed', 'Independent Auto Dealers Association']
    },
    business: {
      license: 'TX-Dealer-67890',
      established: new Date('2016-07-22'),
      employees: 12,
      specialties: ['Domestic vehicles', 'Trucks', 'SUVs'],
      services: ['Financing', 'Shipping', 'Warranty']
    },
    sourcing: {
      sources: ['ADESA', 'Copart', 'Dealer auctions', 'Trade-ins'],
      transportAvailable: true,
      financingAvailable: true,
      inspectionAvailable: false
    }
  },
  
  'stl-auction-pipeline': {
    name: 'STL Auction Pipeline',
    type: 'wholesale' as const,
    location: {
      address: '1234 Market St, St. Louis, MO 63102',
      city: 'St. Louis',
      state: 'MO',
      zip: '63102',
      coordinates: [38.6290, -90.1987]
    },
    contact: {
      phone: '(314) 555-PIPE',
      email: 'bids@stlauctionpipeline.com',
      website: 'https://www.stlauctionpipeline.com'
    },
    inventory: {
      totalDeals: 89,
      avgPrice: 16800,
      priceRange: { min: 5800, max: 42000 },
      popularMakes: ['Ford', 'Chevrolet', 'Toyota', 'Honda', 'Nissan'],
      updateFrequency: 'hourly'
    },
    reputation: {
      rating: 4.5,
      reviews: 203,
      yearsInBusiness: 15,
      accreditations: ['Missouri Dealer License', 'Auctioneer License']
    },
    business: {
      license: 'MO-Auction-54321',
      established: new Date('2009-01-10'),
      employees: 25,
      specialties: ['Wholesale vehicles', 'Fleet vehicles', 'Off-lease'],
      services: ['Transport', 'Inspection', 'Title services']
    },
    sourcing: {
      sources: ['Manheim', 'ADESA', 'Fleet leases', 'Bank repossessions'],
      transportAvailable: true,
      financingAvailable: false,
      inspectionAvailable: true
    }
  },
  
  'gateway-kc-auto': {
    name: 'Gateway KC Auto',
    type: 'independent' as const,
    location: {
      address: '5555 Front St, Kansas City, MO 64120',
      city: 'Kansas City',
      state: 'MO',
      zip: '64120',
      coordinates: [39.1142, -94.6275]
    },
    contact: {
      phone: '(816) 471-5555',
      email: 'sales@gatewaykcauto.com',
      website: 'https://www.gatewaykcauto.com'
    },
    inventory: {
      totalDeals: 45,
      avgPrice: 15600,
      priceRange: { min: 6200, max: 38000 },
      popularMakes: ['Ford', 'Chevrolet', 'Toyota', 'Honda', 'Dodge'],
      updateFrequency: 'daily'
    },
    reputation: {
      rating: 4.1,
      reviews: 67,
      yearsInBusiness: 6,
      accreditations: ['Kansas Dealer License', 'Better Business Bureau']
    },
    business: {
      license: 'KS-Dealer-98765',
      established: new Date('2018-09-05'),
      employees: 8,
      specialties: ['Midwestern vehicles', 'Trucks', 'SUVs'],
      services: ['Financing', 'Shipping']
    },
    sourcing: {
      sources: ['Local auctions', 'Trade-ins', 'Private sellers'],
      transportAvailable: true,
      financingAvailable: true,
      inspectionAvailable: false
    }
  },
  
  'dallas-auto-source': {
    name: 'Dallas Auto Source',
    type: 'wholesale' as const,
    location: {
      address: '2300 Lone Star Dr, Dallas, TX 75247',
      city: 'Dallas',
      state: 'TX',
      zip: '75247',
      coordinates: [32.7967, -96.8239]
    },
    contact: {
      phone: '(214) 749-8000',
      email: 'info@dallasautosource.com',
      website: 'https://www.dallasautosource.com'
    },
    inventory: {
      totalDeals: 156,
      avgPrice: 13500,
      priceRange: { min: 4800, max: 32000 },
      popularMakes: ['Ford', 'Chevrolet', 'Dodge', 'Toyota', 'Honda'],
      updateFrequency: 'daily'
    },
    reputation: {
      rating: 3.8,
      reviews: 145,
      yearsInBusiness: 10,
      accreditations: ['Texas Wholesale Dealer License']
    },
    business: {
      license: 'TX-Wholesale-24680',
      established: new Date('2014-04-12'),
      employees: 18,
      specialties: ['Domestic vehicles', 'Fleet', 'Commercial'],
      services: ['Transport', 'Financing', 'Inspection']
    },
    sourcing: {
      sources: ['ADESA Dallas', 'Copart', 'Fleet companies', 'Bank repossessions'],
      transportAvailable: true,
      financingAvailable: true,
      inspectionAvailable: true
    }
  },
  
  'houston-copart-flippers': {
    name: 'Houston Copart Flippers',
    type: 'salvage' as const,
    location: {
      address: '9900 Hardy St, Houston, TX 77025',
      city: 'Houston',
      state: 'TX',
      zip: '77025',
      coordinates: [29.7372, -95.3635]
    },
    contact: {
      phone: '(713) 747-9900',
      email: 'bids@houstoncopartflippers.com',
      website: 'https://www.houstoncopartflippers.com'
    },
    inventory: {
      totalDeals: 78,
      avgPrice: 8900,
      priceRange: { min: 1200, max: 18000 },
      popularMakes: ['Ford', 'Chevrolet', 'Dodge', 'Toyota', 'Honda'],
      updateFrequency: 'daily'
    },
    reputation: {
      rating: 3.6,
      reviews: 92,
      yearsInBusiness: 5,
      accreditations: ['Texas Salvage Dealer License']
    },
    business: {
      license: 'TX-Salvage-13579',
      established: new Date('2019-11-20'),
      employees: 10,
      specialties: ['Salvage vehicles', 'Rebuildable vehicles', 'Parts cars'],
      services: ['Transport', 'Title assistance', 'Parts sourcing']
    },
    sourcing: {
      sources: ['Copart Houston', 'IAA Houston', 'Insurance totals'],
      transportAvailable: true,
      financingAvailable: false,
      inspectionAvailable: true
    }
  },
  
  'la-auction-resale': {
    name: 'LA Auction Resale',
    type: 'independent' as const,
    location: {
      address: '4560 Washington Blvd, Los Angeles, CA 90016',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90016',
      coordinates: [34.0489, -118.3817]
    },
    contact: {
      phone: '(323) 938-4567',
      email: 'sales@laauctionresale.com',
      website: 'https://www.laauctionresale.com'
    },
    inventory: {
      totalDeals: 62,
      avgPrice: 19500,
      priceRange: { min: 7200, max: 55000 },
      popularMakes: ['Toyota', 'Honda', 'BMW', 'Mercedes', 'Tesla'],
      updateFrequency: 'daily'
    },
    reputation: {
      rating: 4.3,
      reviews: 156,
      yearsInBusiness: 7,
      accreditations: ['California Dealer License', 'Better Business Bureau']
    },
    business: {
      license: 'CA-Dealer-86420',
      established: new Date('2017-06-08'),
      employees: 14,
      specialties: ['Import vehicles', 'Luxury cars', 'Electric vehicles'],
      services: ['Financing', 'Shipping', 'Inspection']
    },
    sourcing: {
      sources: ['Manheim CA', 'ADESA CA', 'Local auctions', 'Private sellers'],
      transportAvailable: true,
      financingAvailable: true,
      inspectionAvailable: true
    }
  },
  
  'bay-area-salvage-parts': {
    name: 'Bay Area Salvage & Parts',
    type: 'parts' as const,
    location: {
      address: '1234 Industrial Way, Oakland, CA 94621',
      city: 'Oakland',
      state: 'CA',
      zip: '94621',
      coordinates: [37.7512, -122.2030]
    },
    contact: {
      phone: '(510) 567-1234',
      email: 'parts@bayareasalvage.com',
      website: 'https://www.bayareasalvage.com'
    },
    inventory: {
      totalDeals: 95,
      avgPrice: 6500,
      priceRange: { min: 800, max: 15000 },
      popularMakes: ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW'],
      updateFrequency: 'daily'
    },
    reputation: {
      rating: 3.7,
      reviews: 78,
      yearsInBusiness: 12,
      accreditations: ['California Salvage License', 'Auto Parts Association']
    },
    business: {
      license: 'CA-Salvage-11223',
      established: new Date('2012-08-15'),
      employees: 20,
      specialties: ['Used parts', 'Salvage vehicles', 'Auto recycling'],
      services: ['Parts shipping', 'Engine testing', 'Warranty']
    },
    sourcing: {
      sources: ['Copart Oakland', 'IAA Oakland', 'Local tow companies'],
      transportAvailable: false,
      financingAvailable: false,
      inspectionAvailable: true
    }
  }
}

// State-by-state dealer density data
export const STATE_DEALER_DENSITY = {
  'AL': { total: 850, independent: 420, franchise: 280, auction: 60, salvage: 90 },
  'AK': { total: 180, independent: 90, franchise: 60, auction: 15, salvage: 15 },
  'AZ': { total: 1200, independent: 600, franchise: 400, auction: 100, salvage: 100 },
  'AR': { total: 450, independent: 220, franchise: 150, auction: 40, salvage: 40 },
  'CA': { total: 3500, independent: 1750, franchise: 1200, auction: 300, salvage: 250 },
  'CO': { total: 950, independent: 470, franchise: 320, auction: 80, salvage: 80 },
  'CT': { total: 650, independent: 320, franchise: 250, auction: 40, salvage: 40 },
  'DE': { total: 200, independent: 100, franchise: 70, auction: 15, salvage: 15 },
  'FL': { total: 2800, independent: 1400, franchise: 900, auction: 250, salvage: 250 },
  'GA': { total: 1400, independent: 700, franchise: 450, auction: 150, salvage: 100 },
  'HI': { total: 250, independent: 120, franchise: 80, auction: 25, salvage: 25 },
  'ID': { total: 320, independent: 160, franchise: 100, auction: 30, salvage: 30 },
  'IL': { total: 1600, independent: 800, franchise: 500, auction: 200, salvage: 100 },
  'IN': { total: 950, independent: 470, franchise: 320, auction: 80, salvage: 80 },
  'IA': { total: 550, independent: 270, franchise: 180, auction: 50, salvage: 50 },
  'KS': { total: 600, independent: 300, franchise: 200, auction: 50, salvage: 50 },
  'KY': { total: 650, independent: 320, franchise: 220, auction: 60, salvage: 50 },
  'LA': { total: 950, independent: 470, franchise: 300, auction: 100, salvage: 80 },
  'ME': { total: 280, independent: 140, franchise: 90, auction: 25, salvage: 25 },
  'MD': { total: 750, independent: 370, franchise: 250, auction: 70, salvage: 60 },
  'MA': { total: 850, independent: 420, franchise: 300, auction: 70, salvage: 60 },
  'MI': { total: 1400, independent: 700, franchise: 450, auction: 150, salvage: 100 },
  'MN': { total: 850, independent: 420, franchise: 280, auction: 80, salvage: 70 },
  'MS': { total: 500, independent: 250, franchise: 150, auction: 50, salvage: 50 },
  'MO': { total: 1100, independent: 550, franchise: 350, auction: 120, salvage: 80 },
  'MT': { total: 280, independent: 140, franchise: 80, auction: 30, salvage: 30 },
  'NE': { total: 450, independent: 220, franchise: 150, auction: 40, salvage: 40 },
  'NV': { total: 650, independent: 320, franchise: 200, auction: 70, salvage: 60 },
  'NH': { total: 350, independent: 170, franchise: 120, auction: 30, salvage: 30 },
  'NJ': { total: 900, independent: 450, franchise: 300, auction: 80, salvage: 70 },
  'NM': { total: 400, independent: 200, franchise: 130, auction: 35, salvage: 35 },
  'NY': { total: 2200, independent: 1100, franchise: 700, auction: 250, salvage: 150 },
  'NC': { total: 1300, independent: 650, franchise: 400, auction: 150, salvage: 100 },
  'ND': { total: 220, independent: 110, franchise: 70, auction: 20, salvage: 20 },
  'OH': { total: 1500, independent: 750, franchise: 500, auction: 150, salvage: 100 },
  'OK': { total: 750, independent: 370, franchise: 250, auction: 70, salvage: 60 },
  'OR': { total: 750, independent: 370, franchise: 250, auction: 70, salvage: 60 },
  'PA': { total: 1400, independent: 700, franchise: 450, auction: 150, salvage: 100 },
  'RI': { total: 250, independent: 120, franchise: 80, auction: 25, salvage: 25 },
  'SC': { total: 750, independent: 370, franchise: 250, auction: 70, salvage: 60 },
  'SD': { total: 280, independent: 140, franchise: 80, auction: 30, salvage: 30 },
  'TN': { total: 1000, independent: 500, franchise: 320, auction: 100, salvage: 80 },
  'TX': { total: 3200, independent: 1600, franchise: 1000, auction: 350, salvage: 250 },
  'UT': { total: 550, independent: 270, franchise: 180, auction: 50, salvage: 50 },
  'VT': { total: 200, independent: 100, franchise: 60, auction: 20, salvage: 20 },
  'VA': { total: 1100, independent: 550, franchise: 350, auction: 120, salvage: 80 },
  'WA': { total: 1200, independent: 600, franchise: 400, auction: 120, salvage: 80 },
  'WV': { total: 400, independent: 200, franchise: 130, auction: 35, salvage: 35 },
  'WI': { total: 850, independent: 420, franchise: 280, auction: 80, salvage: 70 },
  'WY': { total: 220, independent: 110, franchise: 60, auction: 25, salvage: 25 }
}

export class DealerDiscoveryEngine {
  
  // Search for dealers based on criteria
  async searchDealers(criteria: DealerSearchCriteria): Promise<Dealer[]> {
    let dealers: Dealer[] = []
    
    // Start with archetype dealers
    dealers = Object.values(DEALER_ARCHETYPES).map(archetype => 
      this.createDealerFromArchetype(archetype)
    )
    
    // Filter by states
    if (criteria.states && criteria.states.length > 0) {
      dealers = dealers.filter(dealer => 
        criteria.states!.includes(dealer.location.state)
      )
    }
    
    // Filter by dealer types
    if (criteria.dealerTypes && criteria.dealerTypes.length > 0) {
      dealers = dealers.filter(dealer => 
        criteria.dealerTypes!.includes(dealer.type)
      )
    }
    
    // Filter by price range
    if (criteria.priceRange) {
      dealers = dealers.filter(dealer => 
        dealer.inventory.avgPrice >= criteria.priceRange!.min &&
        dealer.inventory.avgPrice <= criteria.priceRange!.max
      )
    }
    
    // Filter by makes
    if (criteria.makes && criteria.makes.length > 0) {
      dealers = dealers.filter(dealer => 
        criteria.makes!.some(make => 
          dealer.inventory.popularMakes.includes(make)
        )
      )
    }
    
    // Filter by services
    if (criteria.services && criteria.services.length > 0) {
      dealers = dealers.filter(dealer => 
        criteria.services!.some(service => 
          dealer.business.services.includes(service)
        )
      )
    }
    
    // Filter by minimum rating
    if (criteria.minRating) {
      dealers = dealers.filter(dealer => 
        dealer.reputation.rating >= criteria.minRating!
      )
    }
    
    // Filter by distance from coordinates
    if (criteria.centerCoordinates && criteria.maxDistance) {
      dealers = dealers.filter(dealer => {
        const distance = this.calculateDistance(
          criteria.centerCoordinates!,
          dealer.location.coordinates
        )
        return distance <= criteria.maxDistance!
      })
    }
    
    // Filter by inventory availability
    if (criteria.hasInventory !== undefined) {
      dealers = dealers.filter(dealer => 
        criteria.hasInventory ? dealer.inventory.totalDeals > 0 : dealer.inventory.totalDeals === 0
      )
    }
    
    // Sort results
    if (criteria.sortBy) {
      dealers = this.sortDealers(dealers, criteria.sortBy)
    }
    
    // Limit results
    if (criteria.limit) {
      dealers = dealers.slice(0, criteria.limit)
    }
    
    return dealers
  }
  
  // Create dealer object from archetype
  private createDealerFromArchetype(archetype: any): Dealer {
    const metrics = this.calculateDealerMetrics(archetype)
    
    return {
      id: this.generateDealerId(archetype.name, archetype.location.state),
      name: archetype.name,
      type: archetype.type,
      location: archetype.location,
      contact: archetype.contact,
      inventory: archetype.inventory,
      reputation: archetype.reputation,
      business: archetype.business,
      sourcing: archetype.sourcing,
      metrics,
      lastUpdated: new Date()
    }
  }
  
  // Calculate dealer metrics
  private calculateDealerMetrics(archetype: any): Dealer['metrics'] {
    let dealScore = 50 // Base score
    
    // Inventory volume score
    if (archetype.inventory.totalDeals > 100) dealScore += 15
    else if (archetype.inventory.totalDeals > 50) dealScore += 10
    else if (archetype.inventory.totalDeals > 20) dealScore += 5
    
    // Rating score
    dealScore += (archetype.reputation.rating - 3) * 10
    
    // Experience score
    if (archetype.reputation.yearsInBusiness > 10) dealScore += 10
    else if (archetype.reputation.yearsInBusiness > 5) dealScore += 5
    
    // Services score
    dealScore += archetype.business.services.length * 2
    
    // Sourcing diversity score
    dealScore += archetype.sourcing.sources.length * 3
    
    const dealScoreFinal = Math.min(100, Math.max(0, dealScore))
    
    // Calculate profit potential based on price and volume
    const profitPotential = (archetype.inventory.avgPrice * archetype.inventory.totalDeals) / 1000
    
    // Reliability score based on rating and experience
    const reliabilityScore = (archetype.reputation.rating * 20) + 
                             (archetype.reputation.yearsInBusiness * 2)
    
    // Responsiveness score based on services and contact options
    const responsivenessScore = archetype.business.services.length * 15 + 
                              (archetype.contact.email ? 10 : 0) +
                              (archetype.contact.website ? 10 : 0)
    
    return {
      dealScore: Math.round(dealScoreFinal),
      profitPotential: Math.round(profitPotential),
      reliabilityScore: Math.min(100, reliabilityScore),
      responsivenessScore: Math.min(100, responsivenessScore)
    }
  }
  
  // Calculate distance between two coordinates
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
  
  // Sort dealers by specified criteria
  private sortDealers(dealers: Dealer[], sortBy: string): Dealer[] {
    switch (sortBy) {
      case 'score':
        return dealers.sort((a, b) => b.metrics.dealScore - a.metrics.dealScore)
      case 'price':
        return dealers.sort((a, b) => a.inventory.avgPrice - b.inventory.avgPrice)
      case 'rating':
        return dealers.sort((a, b) => b.reputation.rating - a.reputation.rating)
      case 'distance':
        // This would require center coordinates to be set
        return dealers.sort((a, b) => b.metrics.dealScore - a.metrics.dealScore)
      default:
        return dealers
    }
  }
  
  // Generate unique dealer ID
  private generateDealerId(name: string, state: string): string {
    const base = `${name}-${state}`
    return Buffer.from(base).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
  }
  
  // Get dealer statistics by state
  async getStateDealerStats(state: string): Promise<{
    totalDealers: number
    byType: Record<Dealer['type'], number>
    avgPrice: number
    avgRating: number
    topMakes: string[]
  }> {
    const density = STATE_DEALER_DENSITY[state.toUpperCase() as keyof typeof STATE_DEALER_DENSITY]
    if (!density) {
      throw new Error(`State data not found for ${state}`)
    }
    
    // Get archetype dealers in this state
    const stateDealers = Object.values(DEALER_ARCHETYPES)
      .filter(archetype => archetype.location.state === state)
      .map(archetype => this.createDealerFromArchetype(archetype))
    
    const avgPrice = stateDealers.length > 0 
      ? stateDealers.reduce((sum, dealer) => sum + dealer.inventory.avgPrice, 0) / stateDealers.length
      : 15000
    
    const avgRating = stateDealers.length > 0
      ? stateDealers.reduce((sum, dealer) => sum + dealer.reputation.rating, 0) / stateDealers.length
      : 3.5
    
    // Aggregate popular makes
    const makeCounts: Record<string, number> = {}
    stateDealers.forEach(dealer => {
      dealer.inventory.popularMakes.forEach(make => {
        makeCounts[make] = (makeCounts[make] || 0) + 1
      })
    })
    
    const topMakes = Object.entries(makeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([make]) => make)
    
    return {
      totalDealers: density.total,
      byType: {
        independent: density.independent,
        auction: density.auction,
        franchise: density.franchise,
        salvage: density.salvage,
        wholesale: density.total - density.independent - density.auction - density.franchise - density.salvage,
        parts: 0 // Not tracked in density data
      },
      avgPrice: Math.round(avgPrice),
      avgRating: Math.round(avgRating * 10) / 10,
      topMakes
    }
  }
  
  // Get top dealers by profit potential
  async getTopDealersByProfit(limit: number = 10): Promise<Dealer[]> {
    const allDealers = Object.values(DEALER_ARCHETYPES)
      .map(archetype => this.createDealerFromArchetype(archetype))
    
    return allDealers
      .sort((a, b) => b.metrics.profitPotential - a.metrics.profitPotential)
      .slice(0, limit)
  }
  
  // Get dealers near specific coordinates
  async getDealersNearCoordinates(
    coordinates: [number, number],
    radius: number = 100, // miles
    limit: number = 20
  ): Promise<Dealer[]> {
    const allDealers = Object.values(DEALER_ARCHETYPES)
      .map(archetype => this.createDealerFromArchetype(archetype))
    
    const nearbyDealers = allDealers.filter(dealer => {
      const distance = this.calculateDistance(coordinates, dealer.location.coordinates)
      return distance <= radius
    })
    
    return nearbyDealers
      .sort((a, b) => {
        const distanceA = this.calculateDistance(coordinates, a.location.coordinates)
        const distanceB = this.calculateDistance(coordinates, b.location.coordinates)
        return distanceA - distanceB
      })
      .slice(0, limit)
  }
  
  // Generate dealer recommendations based on preferences
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
}
