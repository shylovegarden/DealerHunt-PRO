// lib/scrapers/sources/ebay-motors.ts
// ─── eBay Motors scraper using the shared paginate engine ─────────────────────

import type { Listing } from '@/types'
import * as cheerio from 'cheerio'
import {
  paginate,
  extractPrice, extractMileage, extractYear, normalizeUrl,
  type ScraperConfig
} from '../engine'
import { upsertListings } from '../pipeline'

export const EBAY_MOTORS_CONFIG: ScraperConfig = {
  name: 'eBay Motors',
  baseUrl: 'https://www.ebay.com',
  renderMode: 'static',
  requestDelay: 2000,
  concurrency: 3,
  useProxies: true,
  stealth: false,
  maxPages: 15,
  headers: {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
}

const SEARCHES = [
  'ford f150',
  'chevrolet silverado',
  'toyota camry',
  'honda civic',
  'bmw 3 series',
  'mercedes benz',
  'jeep wrangler',
  'dodge ram',
]

export async function scrapeEbayMotors(maxPagesPerSearch = EBAY_MOTORS_CONFIG.maxPages) {
  console.log('[eBay Motors] Starting scrape...')
  const allListings: Partial<Listing>[] = []

  for (const query of SEARCHES) {
    const config = { ...EBAY_MOTORS_CONFIG, maxPages: maxPagesPerSearch }
    const gen = paginate<Partial<Listing>>(
      config,
      (page) =>
        `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}` +
        `&_sacat=6001&_pgn=${page}&_ipg=120`,
      async (input) => {
        const cheerio = await import('cheerio')
        const $ = typeof input === 'string' ? cheerio.load(input) : input
        const items: Partial<Listing>[] = []

        $('.s-item').each((_: number, el: any) => {
          const row = $(el)
          const title = row.find('h3.s-item__title').text().trim()

          // eBay injects sponsored/placeholder rows with no real title
          if (!title || title.toLowerCase().includes('shop on ebay')) return

          const priceText = row.find('span.s-item__price').text().trim()
          const price = extractPrice(priceText)
          if (!price) return

          const mileageText = row.find('div.s-item__subtitle').text().trim()
          const locationText = row.find('span.s-item__location').text().trim()
          const bidText = row.find('span.s-item__bids').text().trim()
          const timeLeftText = row.find('span.s-item__time-left').text().trim()

          const link = row.find('a.s-item__link').attr('href') || row.find('a[href*="/itm/"]').first().attr('href')
          const imgSrc = row.find('img.s-item__image-img').attr('src') || row.find('img').first().attr('src')
          const itemId = link?.split('/itm/')[1]?.split('?')[0] || ''

          const year = extractYear(title)
          const make = title.split(' ')[1] || ''
          const model = title.split(' ').slice(2, 4).join(' ') || ''

          items.push({
            source: 'ebay_motors',
            source_listing_id: itemId,
            source_url: link ? normalizeUrl(link, EBAY_MOTORS_CONFIG.baseUrl) : '',
            title,
            year,
            make,
            model,
            ask_price: price,
            mileage: extractMileage(mileageText),
            condition: 'clean',
            location_city: locationText,
            images: imgSrc ? [imgSrc] : [],
            description: mileageText,
            seller_type: 'private',
            bid_count: bidText ? extractNumber(bidsOnly(bidText)) : undefined,
            auction_end: timeLeftText ? parseTimeLeft(timeLeftText) : undefined,
            scraped_at: new Date().toISOString(),
          })
        })

        const hasMore = $('a.pagination__next').length > 0 && !$('a.pagination__next').hasClass('disabled')
        return { items, hasMore }
      }
    )

    for await (const batch of gen) {
      allListings.push(...batch)
    }
  }

  console.log(`[eBay Motors] Found ${allListings.length} listings`)
  await upsertListings(allListings)
  return allListings.length
}

function bidsOnly(text: string): string {
  const match = text.match(/(\d+)\s*bids?/i)
  return match ? match[1] : '0'
}

function extractNumber(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/(\d+)/)
  return match ? parseInt(match[1]) : undefined
}

function parseTimeLeft(text: string): string | undefined {
  // eBay shows "4d 3h left" or "Ended: Aug 12, 2026 12:00 PM"
  if (!text || text.toLowerCase().includes('ended')) return undefined

  const days = text.match(/(\d+)d/)?.[1]
  const hours = text.match(/(\d+)h/)?.[1]
  const minutes = text.match(/(\d+)m/)?.[1]

  const now = new Date()
  if (days) now.setDate(now.getDate() + parseInt(days))
  if (hours) now.setHours(now.getHours() + parseInt(hours))
  if (minutes) now.setMinutes(now.getMinutes() + parseInt(minutes))

  return now.toISOString()
}
