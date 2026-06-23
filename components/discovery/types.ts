import type { DealGrade } from "./DealGradeBadge";

export interface AlsoOn {
  source: string;
  askPrice: number;
  url: string;
}

/** Shape of a single deal in an /api/discover rail. */
export interface DiscoveryDeal {
  id: string;
  source: string;
  sourceUrl?: string;
  title: string;
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  mileage?: number;
  condition?: string;
  askPrice: number;
  sellEstimate?: number;
  profitScore?: number;
  trueNetProfit?: number;
  recommendedMaxBid?: number;
  dealVerdict?: "go" | "hold" | "pass";
  locationCity?: string;
  locationState?: string;
  images: string[];
  segment?: string;
  luxury?: boolean;
  priceTier?: string;
  titleClass?: "clean" | "rebuilt" | "salvage" | "parts" | "unknown";
  grade: DealGrade;
  discountPct: number;
  gradeLabel: string;
  alsoOn: AlsoOn[];
  listingCount: number;
  firstSeenAt?: string;
  /** Optional context line shown on the card (e.g. "32 mi from you", win-pattern reason). */
  winReason?: string;
  distanceMiles?: number;
}

export interface DiscoveryRail {
  key: string;
  title: string;
  subtitle?: string;
  deals: DiscoveryDeal[];
}

export interface DiscoverResponse {
  rails: DiscoveryRail[];
  totalListings: number;
  uniqueVehicles: number;
  mergedDuplicates: number;
  state: string;
  personalized?: boolean;
}
