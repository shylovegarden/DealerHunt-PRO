import { NextRequest, NextResponse } from 'next/server'
import { DealsService } from '@/lib/data/deals-service'
import { GeographicArbitrageEngine } from '@/lib/geographic/geographic-arbitrage'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const homeState = searchParams.get('homeState') || 'CA' // Default to California if not provided

    const dealsService = new DealsService()
    const engine = new GeographicArbitrageEngine()
    
    // Fetch top 50 recent/hot deals
    const { deals: recentDeals } = await dealsService.getDeals({ limit: 50, sortBy: 'lastSeenAt', sortOrder: 'desc' })

    const localDeals = []
    const nationalArbitrage = []

    for (const deal of recentDeals) {
      const sourceState = deal.locationState || 'TX'
      
      if (sourceState === homeState) {
        localDeals.push(deal)
        continue
      }
      
      try {
        // Find arbitrage opportunities for this specific vehicle
        const opportunities = await engine.findArbitrageOpportunities({
          year: deal.year,
          make: deal.make,
          model: deal.model,
          price: deal.askPrice || 10000,
          condition: deal.damageType || 'clean',
          sourceState: sourceState,
        })
        
        // Filter to see if there's an opportunity in our homeState
        const homeOpp = opportunities.find(o => o.targetRegion.state === homeState)
        
        if (homeOpp && homeOpp.arbitrage.profitMargin > 10) {
          nationalArbitrage.push({
            deal,
            arbitrage: homeOpp
          })
        }
      } catch (err) {
        // Skip if market data isn't found for a state
        continue
      }
    }

    // Sort national deals by profit margin
    nationalArbitrage.sort((a, b) => b.arbitrage.arbitrage.profitMargin - a.arbitrage.arbitrage.profitMargin)

    // Get some general top routes
    const topRoutes = await engine.getOptimalTransportRoutes('TX', ['CA', 'NY', 'FL', 'IL'])

    return NextResponse.json({
      homeState,
      topRoutes,
      localDeals,
      nationalArbitrage: nationalArbitrage.slice(0, 15), // Top 15 national deals
    })
  } catch (error: any) {
    console.error('Error fetching arbitrage dashboard data:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
