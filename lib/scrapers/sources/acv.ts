// lib/scrapers/sources/acv.ts
// ─── ACV Auctions wholesale scraper (requires dealer account) ─────────────────

import type { Deal } from '@/types'
import * as cheerio from 'cheerio'
import { paginate, extractPrice, extractMileage, extractYear, normalizeUrl, type ScraperConfig } from '../engine'
import { upsertDeals } from '../pipeline'

export const ACV_CONFIG: ScraperConfig = {
  name: 'ACV Auctions',
  baseUrl: 'https://www.acvauctions.com',
  renderMode: 'adaptive',
  requestDelay: 3000,
  concurrency: 2,
  useProxies: true,
  stealth: true,
  maxPages: 12,
  headers: { 'Accept-Language': 'en-US,en;q=0.9' },
}

export async function scrapeAcv(maxPages = ACV_CONFIG.maxPages) {
  console.log('[ACV Auctions] Starting scrape...')
  const allDeals: Partial<Deal>[] = []

  const config = { ...ACV_CONFIG, maxPages }
  const gen = paginate<Partial<Deal>>(
    config,
    (page) => `https://www.acvauctions.com/marketplace?page=${page}`,
    async (input) => {
      const $ = typeof input === 'string' ? cheerio.load(input) : input
      const items: Partial<Deal>[] = []

      $('div.deal-item, div[data-testid="vehicle-card"], .vehicle-deal').each((_: number, el: any) => {
        const row = $(el)
        const title = row.find('h2.vehicle-title, .vehicle-title').text().trim()
        if (!title) return

        const priceText = row.find('span.current-price, .current-price').text().trim()
        const price = extractPrice(priceText)
        if (!price) return

        const mileageText = row.find('span.vehicle-mileage, .vehicle-mileage').text().trim()
        const vinText = row.find('span.vehicle-vin, .vehicle-vin').text().trim()
        const locationText = row.find('span.vehicle-location, .vehicle-location').text().trim()
        const link = row.find('a[href*="/vehicle/"]').attr('href') || row.find('a').first().attr('href')
        const imgSrc = row.find('img.vehicle-image, img').first().attr('src')
        const itemId = vinText || link?.split('/vehicle/')[1]?.split('?')[0] || ''

        items.push({
          source: 'acv',
          source_deal_id: itemId,
          source_url: link ? normalizeUrl(link, ACV_CONFIG.baseUrl) : '',
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

      const hasMore = $('button.load-more, a.next-page, a.pagination-next').length > 0
      return { items, hasMore }
    }
  )

  for await (const batch of gen) {
    allDeals.push(...batch)
  }

  console.log(`[ACV Auctions] Found ${allDeals.length} deals (requires dealer account for live data)`)
  await upsertDeals(allDeals)
  return allDeals.length
}
