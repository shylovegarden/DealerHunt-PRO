// lib/scrapers/sources/adesa.ts
// ─── ADESA auction scraper (requires dealer account / API token) ────────────────

import type { Listing } from '@/types'
import * as cheerio from 'cheerio'
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from '../engine'
import { upsertListings } from '../pipeline'

export const ADESA_CONFIG: ScraperConfig = {
  name: 'ADESA',
  baseUrl: 'https://www.adesa.com',
  renderMode: 'adaptive',
  requestDelay: 3000,
  concurrency: 1,
  useProxies: true,
  stealth: true,
  maxPages: 8,
  headers: { 'Accept-Language': 'en-US,en;q=0.9' },
}

export async function scrapeAdesa(maxPages = ADESA_CONFIG.maxPages) {
  console.log('[ADESA] Starting scrape...')

  // ADESA requires a dealer account. Attempt public lot search; if blocked, return 0.
  const allListings: Partial<Listing>[] = []
  const config = { ...ADESA_CONFIG, maxPages }

  const gen = paginate<Partial<Listing>>(
    config,
    (page) => `https://www.adesa.com/locations/public-sales?page=${page}`,
    async (input) => {
      const $ = typeof input === 'string' ? cheerio.load(input) : input
      const items: Partial<Listing>[] = []

      $('div.auction-item, div.lot-card, .vehicle-listing').each((_: number, el: any) => {
        const row = $(el)
        const title = row.find('h4.lot-title, .lot-title').text().trim()
        if (!title) return

        const priceText = row.find('span.current-bid, .current-bid').text().trim()
        const price = extractPrice(priceText)
        if (!price) return

        const mileageText = row.find('span.lot-mileage, .lot-mileage').text().trim()
        const vinText = row.find('span.lot-vin, .lot-vin').text().trim()
        const locationText = row.find('span.lot-location, .lot-location').text().trim()
        const link = row.find('a[href*="/lot/"]').attr('href') || row.find('a').first().attr('href')
        const imgSrc = row.find('img.lot-image, img').first().attr('src')
        const itemId = vinText || link?.split('/lot/')[1]?.split('?')[0] || ''

        items.push({
          source: 'adesa',
          source_listing_id: itemId,
          source_url: link ? normalizeUrl(link, ADESA_CONFIG.baseUrl) : '',
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

      const hasMore = $('a.pagination-next, a.next-page').length > 0
      return { items, hasMore }
    }
  )

  for await (const batch of gen) {
    allListings.push(...batch)
  }

  console.log(`[ADESA] Found ${allListings.length} listings (requires dealer account for live inventory)`)
  await upsertListings(allListings)
  return allListings.length
}
