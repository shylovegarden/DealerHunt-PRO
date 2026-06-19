export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { PartsCalculator } from '@/lib/parts/parts-calculator'


export async function POST(request: NextRequest) {
  try {
    const partsCalculator = new PartsCalculator()
    const body = await request.json()
    const { vehicleInfo, analysisType = 'teardown' } = body

    // Validate vehicle info
    if (!vehicleInfo || !vehicleInfo.year || !vehicleInfo.make || !vehicleInfo.model) {
      return NextResponse.json({ 
        error: 'Vehicle year, make, and model are required' 
      }, { status: 400 })
    }

    let result

    switch (analysisType) {
      case 'teardown':
        result = await partsCalculator.calculateTearDown(vehicleInfo)
        break
      case 'compare':
        result = await partsCalculator.compareProfitability(vehicleInfo)
        break
      case 'repairs':
        result = await partsCalculator.estimateRepairCosts(vehicleInfo)
        break
      default:
        return NextResponse.json({ 
          error: 'Invalid analysis type. Use teardown, compare, or repairs' 
        }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in parts analysis:', error)
    return NextResponse.json({ 
      error: 'Failed to perform parts analysis' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const partsCalculator = new PartsCalculator()
    const { searchParams } = new URL(request.url)
    const vin = searchParams.get('vin')

    if (!vin) {
      return NextResponse.json({ 
        error: 'VIN parameter is required' 
      }, { status: 400 })
    }

    // This would integrate with a VIN decoder service
    // For now, return sample vehicle info
    const vehicleInfo = {
      vin,
      year: 2019,
      make: 'Toyota',
      model: 'Camry',
      purchasePrice: 12000,
      condition: 'clean'
    }

    const analysis = await partsCalculator.calculateTearDown(vehicleInfo)

    return NextResponse.json(analysis)

  } catch (error) {
    console.error('Error getting VIN analysis:', error)
    return NextResponse.json({ 
      error: 'Failed to get VIN analysis' 
    }, { status: 500 })
  }
}
