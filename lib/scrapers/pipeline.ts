// lib/scrapers/pipeline.ts
// Persistence helpers for scraped listings.

import { createClient } from '@supabase/supabase-js'
import { Listing } from '@/types'
import { DealScoringService } from './tools/deal-scoring'
import { QualityController } from './tools/quality-control'
import { normalizeListings } from './tools/listing-normalizer'

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(supabaseUrl, supabaseKey)
}

export async function upsertListings(listings: Partial<Listing>[]): Promise<number> {
  if (!listings.length) return 0

  const now = new Date().toISOString()
  const scorer = new DealScoringService()
  const quality = new QualityController()

  const source = listings[0]?.source || 'unknown'
  const normalized = normalizeListings(listings)
  const report = quality.validateBatch(source, normalized)
  if (report.issues.length > 0) {
    console.warn(`[Pipeline] quality report for ${source}:`, report)
  }

  const rows = report.validListings.map(listing => {
    const scored = scorer.scoreListing(listing)
    const source_listing_id = listing.source_listing_id || listing.id || `${listing.source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const id = listing.id || `${listing.source}-${source_listing_id}`

    return {
      id,
      source: listing.source,
      source_listing_id,
      source_url: listing.source_url,
      dealer_id: listing.dealer_id,
      title: listing.title,
      year: listing.year,
      make: listing.make,
      model: listing.model,
      trim: listing.trim,
      vin: listing.vin,
      ask_price: listing.ask_price,
      mileage: listing.mileage,
      condition: listing.condition,
      damage_type: listing.damage_type,
      location_city: listing.location_city,
      location_state: listing.location_state,
      location_zip: listing.location_zip,
      images: listing.images || [],
      description: listing.description,
      seller: listing.seller,
      seller_type: listing.seller_type,
      auction_end: listing.auction_end,
      bid_count: listing.bid_count,
      transport_cost: scored.transport_cost,
      repair_estimate: scored.repair_estimate,
      profit_estimate: scored.profit_estimate,
      profit_score: scored.profit_score,
      is_arbitrage_opportunity: scored.is_arbitrage_opportunity,
      scraped_at: listing.scraped_at || now,
      metadata: listing.metadata || {},
      created_at: listing.created_at || now,
      updated_at: now,
    }
  })

  const { error } = await getSupabase()
    .from('listings')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

  if (error) {
    console.error('[upsertListings] Error:', error)
    throw new Error(`Failed to upsert listings: ${error.message}`)
  }

  // Insert price history for listings that have a price
  const priceHistoryRows = rows
    .filter(r => typeof r.ask_price === 'number')
    .map(r => ({
      listing_id: r.id,
      price: r.ask_price,
      observed_at: r.updated_at,
      source: r.source,
    }))

  if (priceHistoryRows.length > 0) {
    const { error: priceError } = await getSupabase()
      .from('price_history')
      .insert(priceHistoryRows)

    if (priceError) {
      console.warn('[upsertListings] Price history insert warning:', priceError)
    }
  }

  // Mark duplicate listings by VIN
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
      console.warn('[upsertListings] Duplicate detection warning:', fallbackError)
    }
  }
}

export async function insertPriceHistory(listingId: string, price: number, source: string): Promise<void> {
  const { error } = await getSupabase()
    .from('price_history')
    .insert({
      listing_id: listingId,
      price,
      date: new Date().toISOString().split('T')[0],
      source,
      observed_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[insertPriceHistory] Error:', error)
  }
}
