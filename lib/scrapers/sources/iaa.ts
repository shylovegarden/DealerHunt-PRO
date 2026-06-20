// lib/scrapers/sources/iaa.ts
// ─── IAA salvage auction scraper (requires dealer license / auth) ─────────────

import type { Deal } from '@/types'
import * as cheerio from 'cheerio'
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from '../engine'
import { upsertDeals } from '../pipeline'

export const IAA_CONFIG: ScraperConfig = {
  name: 'IAA',
  baseUrl: 'https://www.iaai.com',
  renderMode: 'adaptive',
  requestDelay: 3000,
  concurrency: 2,
  useProxies: true,
  stealth: true,
  maxPages: 10,
  headers: { 'Accept-Language': 'en-US,en;q=0.9' },
}

export async function scrapeIaa(searchTerms: string[] = ['ford', 'toyota', 'chevrolet'], maxPagesPerSearch = IAA_CONFIG.maxPages) {
  console.log('[IAA] Starting scrape...')
  const allDeals: Partial<Deal>[] = []

  for (const term of searchTerms) {
    const config = { ...IAA_CONFIG, maxPages: maxPagesPerSearch }
    const gen = paginate<Partial<Deal>>(
      config,
      (page) =>
        `https://www.iaai.com/vehicles?searchQuery=${encodeURIComponent(term)}&page=${page}&pageSize=100`,
      async (input) => {
        const $ = typeof input === 'string' ? cheerio.load(input) : input
        const items: Partial<Deal>[] = []

        $('div.vehicle-item, div[data-testid="vehicle-card"], .search-results .vehicle').each((_: number, el: any) => {
          const row = $(el)
          const title = row.find('h3.vehicle-title, .vehicle-title').text().trim()
          if (!title) return

          const priceText = row.find('span.bid-current, .bid-current, .current-bid').text().trim()
          const price = extractPrice(priceText)
          if (!price) return

          const mileageText = row.find('span.vehicle-mileage, .vehicle-mileage').text().trim()
          const vinText = row.find('span.vehicle-vin, .vehicle-vin').text().trim()
          const locationText = row.find('span.vehicle-location, .vehicle-location').text().trim()
          const link = row.find('a[href*="/vehicles/"]').attr('href') || row.find('a').first().attr('href')
          const imgSrc = row.find('img.vehicle-image, img').first().attr('src')
          const itemId = vinText || link?.split('/vehicles/')[1]?.split('?')[0] || ''

          items.push({
            source: 'iaa',
            source_deal_id: itemId,
            source_url: link ? normalizeUrl(link, IAA_CONFIG.baseUrl) : '',
            title,
            year: extractYear(title),
            make: title.split(' ')[1] || '',
            model: title.split(' ').slice(2, 4).join(' ') || '',
            vin: vinText,
            ask_price: price,
            mileage: extractMileage(mileageText),
            condition: 'salvage',
            location_city: locationText,
            images: imgSrc ? [imgSrc] : [],
            scraped_at: new Date().toISOString(),
          })
        })

        const hasMore = $('a.next-page, a.pagination-next, button[aria-label="Next page"]').length > 0
        return { items, hasMore }
      }
    )

    for await (const batch of gen) {
      allDeals.push(...batch)
    }
  }

  console.log(`[IAA] Found ${allDeals.length} deals (requires dealer auth for live data)`)
  await upsertDeals(allDeals)
  return allDeals.length
}
