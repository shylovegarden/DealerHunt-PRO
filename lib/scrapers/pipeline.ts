// lib/scrapers/pipeline.ts
// Persistence helpers for scraped deals.

import { createClient } from '@supabase/supabase-js'
import { Deal } from '@/types'
import { DealScoringService } from './tools/deal-scoring'
import { QualityController } from './tools/quality-control'
import { normalizeDeals } from './tools/deal-normalizer'

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(supabaseUrl, supabaseKey)
}

export async function upsertDeals(deals: Partial<Deal>[]): Promise<number> {
  if (!deals.length) return 0

  const now = new Date().toISOString()
  const scorer = new DealScoringService()
  const quality = new QualityController()

  const source = deals[0]?.source || 'unknown'
  const normalized = normalizeDeals(deals)
  const report = quality.validateBatch(source, normalized)
  if (report.issues.length > 0) {
    console.warn(`[Pipeline] quality report for ${source}:`, report)
  }

  const rows = report.validDeals.map(deal => {
    const scored = scorer.scoreDeal(deal)
    const source_deal_id = deal.source_deal_id || deal.id || `${deal.source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const id = deal.id || `${deal.source}-${source_deal_id}`

    return {
      id,
      source: deal.source,
      source_deal_id,
      source_url: deal.source_url,
      dealer_id: deal.dealer_id,
      title: deal.title,
      year: deal.year,
      make: deal.make,
      model: deal.model,
      trim: deal.trim,
      vin: deal.vin,
      ask_price: deal.ask_price,
      mileage: deal.mileage,
      condition: deal.condition,
      damage_type: deal.damage_type,
      location_city: deal.location_city,
      location_state: deal.location_state,
      location_zip: deal.location_zip,
      images: deal.images || [],
      description: deal.description,
      seller: deal.seller,
      seller_type: deal.seller_type,
      auction_end: deal.auction_end,
      bid_count: deal.bid_count,
      transport_cost: scored.transport_cost,
      repair_estimate: scored.repair_estimate,
      profit_estimate: scored.profit_estimate,
      profit_score: scored.profit_score,
      is_arbitrage_opportunity: scored.is_arbitrage_opportunity,
      scraped_at: deal.scraped_at || now,
      metadata: deal.metadata || {},
      created_at: deal.created_at || now,
      updated_at: now,
    }
  })

  const { error } = await getSupabase()
    .from('deals')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

  if (error) {
    console.error('[upsertDeals] Error:', error)
    throw new Error(`Failed to upsert deals: ${error.message}`)
  }

  // Insert price history for deals that have a price
  const priceHistoryRows = rows
    .filter(r => typeof r.ask_price === 'number')
    .map(r => ({
      deal_id: r.id,
      price: r.ask_price,
      observed_at: r.updated_at,
      source: r.source,
    }))

  if (priceHistoryRows.length > 0) {
    const { error: priceError } = await getSupabase()
      .from('price_history')
      .insert(priceHistoryRows)

    if (priceError) {
      console.warn('[upsertDeals] Price history insert warning:', priceError)
    }
  }

  // Mark duplicate deals by VIN
  const vinRows = rows.filter(r => r.vin)
  if (vinRows.length > 0) {
    await markDuplicatesByVin(vinRows.map(r => r.vin as string))
  }

  return rows.length
}

async function markDuplicatesByVin(vins: string[]): Promise<void> {
  const { error } = await getSupabase().rpc('detect_duplicates_by_vin', {
    vin_filter: vins,
  })

  if (error) {
    // Fallback to RPC without parameter if function doesn't accept it
    const { error: fallbackError } = await getSupabase().rpc('detect_duplicates_by_vin')
    if (fallbackError) {
      console.warn('[upsertDeals] Duplicate detection warning:', fallbackError)
    }
  }
}

export async function insertPriceHistory(dealId: string, price: number, source: string): Promise<void> {
  const { error } = await getSupabase()
    .from('price_history')
    .insert({
      deal_id: dealId,
      price,
      date: new Date().toISOString().split('T')[0],
      source,
      observed_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[insertPriceHistory] Error:', error)
  }
}
