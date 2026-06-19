// lib/scrapers/tools/listing-normalizer.ts
// Normalize scraped listing fields before validation and persistence to improve accuracy and deduplication.

import type { Listing } from '@/types'

const MAKES = [
  'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ford',
  'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus',
  'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mercury', 'Mini', 'Mitsubishi', 'Nissan', 'Porsche',
  'Ram', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
]

export function normalizeVin(vin?: string): string | undefined {
  if (!vin) return undefined
  const cleaned = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '')
  return cleaned.length === 17 ? cleaned : undefined
}

export function normalizeTitle(title?: string): string | undefined {
  if (!title) return undefined
  return title
    .replace(/\s+/g, ' ')
    .replace(/\b(\d{4})\s+/g, '$1 ')
    .trim()
}

export function extractYear(title?: string): number | undefined {
  if (!title) return undefined
  const match = title.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0], 10) : undefined
}

export function extractMake(title?: string): string | undefined {
  if (!title) return undefined
  const upper = title.toUpperCase()
  for (const make of MAKES) {
    if (upper.includes(make.toUpperCase())) return make
  }
  return undefined
}

export function extractModel(title?: string, make?: string): string | undefined {
  if (!title || !make) return undefined
  const pattern = new RegExp(`${make}\\s+([A-Za-z0-9-]+)`, 'i')
  const match = title.match(pattern)
  if (!match) return undefined
  return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
}

export function normalizeLocation(location?: string): string | undefined {
  if (!location) return undefined
  return location
    .replace(/\s+/g, ' ')
    .replace(/,\s+/g, ', ')
    .trim()
}

export function normalizeListing(listing: Partial<Listing>): Partial<Listing> {
  const normalized = { ...listing }

  normalized.vin = normalizeVin(normalized.vin)
  normalized.title = normalizeTitle(normalized.title)
  normalized.year = normalized.year || extractYear(normalized.title)
  normalized.make = normalized.make || extractMake(normalized.title)
  normalized.model = normalized.model || extractModel(normalized.title, normalized.make)
  normalized.location_city = normalizeLocation(normalized.location_city)
  normalized.location_state = normalizeLocation(normalized.location_state)

  if (normalized.ask_price !== undefined) {
    normalized.ask_price = Math.max(0, Math.round(normalized.ask_price))
  }
  if (normalized.mileage !== undefined) {
    normalized.mileage = Math.max(0, Math.round(normalized.mileage))
  }

  return normalized
}

export function normalizeListings(listings: Partial<Listing>[]): Partial<Listing>[] {
  return listings.map(normalizeListing)
}
