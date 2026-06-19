import { describe, it, expect } from 'vitest'
import { normalizeListing, normalizeVin, normalizeTitle, extractYear, extractMake, extractModel } from './listing-normalizer'

describe('listing normalizer', () => {
  it('normalizes VIN to 17 uppercase chars', () => {
    expect(normalizeVin('1hgcm82633a123456')).toBe('1HGCM82633A123456')
    expect(normalizeVin('abc')).toBeUndefined()
  })

  it('cleans and trims title', () => {
    expect(normalizeTitle('  2019   Honda  Accord  ')).toBe('2019 Honda Accord')
  })

  it('extracts year, make, model from title', () => {
    expect(extractYear('2020 Toyota Camry')).toBe(2020)
    expect(extractMake('2019 Ford F-150')).toBe('Ford')
    expect(extractModel('2019 Ford F-150', 'Ford')).toBe('F-150')
  })

  it('normalizes a full listing', () => {
    const listing = normalizeListing({
      source: 'test',
      title: '  2019   honda  accord  ',
      vin: '1hgcm82633a123456',
      ask_price: 12000.7,
      mileage: 45000.2,
      location_city: 'Austin ',
      location_state: ' TX',
    })
    expect(listing.title).toBe('2019 honda accord')
    expect(listing.vin).toBe('1HGCM82633A123456')
    expect(listing.year).toBe(2019)
    expect(listing.make).toBe('Honda')
    expect(listing.model).toBe('Accord')
    expect(listing.ask_price).toBe(12001)
    expect(listing.mileage).toBe(45000)
    expect(listing.location_city).toBe('Austin')
    expect(listing.location_state).toBe('TX')
  })
})
