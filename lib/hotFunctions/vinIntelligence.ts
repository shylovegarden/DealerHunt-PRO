import { decodeVIN } from '../api/vin';

// Mock getMarketValueCached and getComparableListings for now
async function getMarketValueCached(vin: string) { return 15000; }
async function getComparableListings(vin: string) { return [14000, 15500, 16000]; }

export async function getFullVINIntelligence(vin: string) {
  const [vinData, marketValue, comparables] = await Promise.all([
    decodeVIN(vin),                    // mcp.vin — specs + recalls + safety
    getMarketValueCached(vin),         // MarketCheck — what similar cars sell for
    getComparableListings(vin),        // What's currently listed near dealer
  ]);
  
  return {
    vehicle: vinData,
    recalls: { count: vinData?.recallCount, open: vinData?.recalls || [] },
    safety:  { rating: vinData?.safetyRating, complaints: vinData?.complaints },
    market:  { value: marketValue, comparables, daysSupply: comparables?.length },
    fuel:    { mpgCity: vinData?.mpgCity, mpgHwy: vinData?.mpgHwy, annualCost: vinData?.annualFuelCost },
    photos:  vinData?.photos || [],
  };
}
