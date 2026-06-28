// lib/housing/types.ts
//
// HomeIQ's core entity — the housing equivalent of a car Deal. Deliberately vertical-SPECIFIC (address /
// beds / baths / sqft instead of make / model / VIN) so the schema stays clean, while the SHARED engine
// (chameleon scraper, geocoding, OSRM, lead scoring, pipeline) treats it the same way. A Property is what
// AutoVerse's Deal is: one harvested listing the platform can value, score, map, and act on.

export type PropertyType =
  | "single_family"
  | "multi_family"
  | "condo"
  | "townhouse"
  | "land"
  | "mobile"
  | "commercial"
  | "other";

export interface Property {
  source: string; // gov_auction | craigslist | zillow | fsbo | foreclosure | …
  source_listing_id?: string;
  source_url?: string;

  title: string;
  property_type?: PropertyType;

  // Location — the spine of the housing vertical.
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;

  // Money.
  price?: number; // ask / current bid
  // Structure.
  beds?: number;
  baths?: number;
  sqft?: number;
  lot_size_acres?: number;
  year_built?: number;

  images?: string[];
  description?: string;

  // Auction / seller context (gov + foreclosure leads are auctions).
  seller?: string;
  seller_type?: "auction" | "owner" | "agent" | "bank" | "gov";
  auction_end?: string;
  bid_count?: number;

  // Lead-intelligence signals (price cuts, DOM, vacancy, pre-foreclosure…) — filled by the scoring layer.
  signals?: Record<string, unknown>;
  lead_score?: number;

  scraped_at?: string;
}
