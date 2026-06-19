// lib/scrapers/sources/manheim.ts
// ─── Manheim auction scraper (requires dealer account / API token) ──────────────

import type { Listing } from '@/types'
import * as cheerio from 'cheerio'
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from '../engine'
import { upsertListings } from '../pipeline'

export const MANHEIM_CONFIG: ScraperConfig = {
  name: 'Manheim',
  baseUrl: 'https://www.manheim.com',
  renderMode: 'adaptive',
  requestDelay: 3000,
  concurrency: 1,
  useProxies: true,
  stealth: true,
  maxPages: 8,
  headers: { 'Accept-Language': 'en-US,en;q=0.9' },
}

export async function scrapeManheim(maxPages = MANHEIM_CONFIG.maxPages) {
  console.log('[Manheim] Starting scrape...')

  const allListings: Partial<Listing>[] = []
  const config = { ...MANHEIM_CONFIG, maxPages }

  const gen = paginate<Partial<Listing>>(
    config,
    (page) => `https://www.manheim.com/members/inventory/search?page=${page}`,
    async (input) => {
      const $ = typeof input === 'string' ? cheerio.load(input) : input
      const items: Partial<Listing>[] = []

      $('div.vehicle-card, div.listing-item, .inventory-item').each((_: number, el: any) => {
        const row = $(el)
        const title = row.find('h3.vehicle-title, .vehicle-title').text().trim()
        if (!title) return

        const priceText = row.find('span.bid-amount, .bid-amount').text().trim()
        const price = extractPrice(priceText)
        if (!price) return

        const mileageText = row.find('span.vehicle-mileage, .vehicle-mileage').text().trim()
        const vinText = row.find('span.vehicle-vin, .vehicle-vin').text().trim()
        const locationText = row.find('span.vehicle-location, .vehicle-location').text().trim()
        const link = row.find('a[href*="/vehicle/"]').attr('href') || row.find('a').first().attr('href')
        const imgSrc = row.find('img.vehicle-photo, img').first().attr('src')
        const itemId = vinText || link?.split('/vehicle/')[1]?.split('?')[0] || ''

        items.push({
          source: 'manheim',
          source_listing_id: itemId,
          source_url: link ? normalizeUrl(link, MANHEIM_CONFIG.baseUrl) : '',
          title,
          year: extractYear(title),
          make: title.split(' ')[1] || '',
          model: title.split(' ').slice(2, 4).join(' ') || '',
          vin: vinText,
          ask_price: price,
          mileage: extractMileage(mileageText),
          condition: 'clean',
          location_city: locationText,
          images: imgSrc ? [imgSrc] : [],
          seller_type: 'auction',
          scraped_at: new Date().toISOString(),
        })
      })

      const hasMore = $('a.next-page, a.pagination-next').length > 0
      return { items, hasMore }
    }
  )

  for await (const batch of gen) {
    allListings.push(...batch)
  }

  console.log(`[Manheim] Found ${allListings.length} listings (requires dealer account for live inventory)`)
  await upsertListings(allListings)
  return allListings.length
}
