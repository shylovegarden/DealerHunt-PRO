import { createServerComponentClient } from '@/lib/supabase'

export type InventoryStage = 'acquired' | 'recon' | 'transport' | 'listed' | 'offer' | 'sold' | 'wholesale'

export type InventoryItem = {
  id: string
  dealerId: string
  vehicleId?: string
  vin: string
  year: number
  make: string
  model: string
  trim?: string
  color?: string
  odometer?: number
  condition: string
  description?: string
  purchasePrice: number
  auctionFee: number
  transportCost: number
  repairCost: number
  reconCost: number
  titleFee: number
  holdingCost: number
  otherCosts: number
  totalCost: number
  listPrice?: number
  marketValue?: number
  stage: InventoryStage
  floorDate: Date
  dailyFloorRate: number
  soldDate?: Date
  soldPrice?: number
  photos: string[]
  listedPlatforms: string[]
  leadCount: number
  purchasedFrom?: string
  purchasedCity?: string
  purchasedState?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export type InventoryFilters = {
  stage?: InventoryStage[]
  limit?: number
  offset?: number
}

export class InventoryService {
  private supabase = createServerComponentClient()

  private mapDbToItem(row: any): InventoryItem {
    return {
      id: row.id,
      dealerId: row.dealer_id,
      vehicleId: row.vehicle_id,
      vin: row.vin,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.trim,
      color: row.color,
      odometer: row.odometer,
      condition: row.condition,
      description: row.description,
      purchasePrice: Number(row.purchase_price || 0),
      auctionFee: Number(row.auction_fee || 0),
      transportCost: Number(row.transport_cost || 0),
      repairCost: Number(row.repair_cost || 0),
      reconCost: Number(row.recon_cost || 0),
      titleFee: Number(row.title_fee || 0),
      holdingCost: Number(row.holding_cost || 0),
      otherCosts: Number(row.other_costs || 0),
      totalCost: Number(row.total_cost || 0),
      listPrice: row.list_price ? Number(row.list_price) : undefined,
      marketValue: row.market_value ? Number(row.market_value) : undefined,
      stage: row.stage,
      floorDate: new Date(row.floor_date),
      dailyFloorRate: Number(row.daily_floor_rate || 0),
      soldDate: row.sold_date ? new Date(row.sold_date) : undefined,
      soldPrice: row.sold_price ? Number(row.sold_price) : undefined,
      photos: row.photos || [],
      listedPlatforms: row.listed_platforms || [],
      leadCount: row.lead_count || 0,
      purchasedFrom: row.purchased_from,
      purchasedCity: row.purchased_city,
      purchasedState: row.purchased_state,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  async getInventory(dealerId: string, filters: InventoryFilters = {}): Promise<{
    items: InventoryItem[]
    total: number
    hasMore: boolean
  }> {
    let query = this.supabase
      .from('inventory')
      .select('*', { count: 'exact' })
      .eq('dealer_id', dealerId)

    if (filters.stage?.length) {
      query = query.in('stage', filters.stage)
    }

    query = query.order('floor_date', { ascending: false })

    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`)
    }

    const items = (data || []).map(this.mapDbToItem)
    const total = count || 0
    const limit = filters.limit || 20
    const offset = filters.offset || 0
    const hasMore = offset + items.length < total

    return { items, total, hasMore }
  }

  async getItemById(id: string): Promise<InventoryItem | null> {
    const { data, error } = await this.supabase
      .from('inventory')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch inventory item: ${error.message}`)
    }

    return this.mapDbToItem(data)
  }

  async updateStage(id: string, stage: InventoryStage): Promise<InventoryItem> {
    const { data, error } = await this.supabase
      .from('inventory')
      .update({ stage })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update stage: ${error.message}`)
    }

    return this.mapDbToItem(data)
  }

  async getStats(dealerId: string): Promise<{
    total: number
    byStage: Record<InventoryStage, number>
    totalHoldingCost: number
    totalMarketValue: number
  }> {
    const { data, error } = await this.supabase
      .from('inventory')
      .select('stage, holding_cost, market_value, total_cost')
      .eq('dealer_id', dealerId)

    if (error) {
      throw new Error(`Failed to fetch inventory stats: ${error.message}`)
    }

    const stages: InventoryStage[] = ['acquired', 'recon', 'transport', 'listed', 'offer', 'sold', 'wholesale']
    const byStage: Record<InventoryStage, number> = Object.fromEntries(stages.map((s) => [s, 0])) as Record<InventoryStage, number>
    let totalHoldingCost = 0
    let totalMarketValue = 0

    for (const item of data || []) {
      const stage = item.stage as InventoryStage
      if (stage in byStage) {
        byStage[stage] += 1
      }
      totalHoldingCost += Number(item.holding_cost || 0)
      totalMarketValue += Number(item.market_value || item.total_cost || 0)
    }

    return {
      total: data?.length || 0,
      byStage,
      totalHoldingCost,
      totalMarketValue,
    }
  }
}
