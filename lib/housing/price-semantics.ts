// lib/housing/price-semantics.ts
//
// The housing twin of lib/sources/source-meta (cars): per HOUSING source, what does the listed price
// actually mean? Government/surplus listings are AUCTIONS — the number is a STARTING BID, not a sale
// price. HUD is a bid process but shows a LIST price. Land banks sell at a set PRICE. Portals (Redfin)
// are ASKING. So a card can say "Starting bid $X" instead of implying it's the price you'll pay.

export type HousingPriceKind = "auction" | "list" | "asking";

export interface HousingPriceTerms {
  /** What the headline number represents. */
  priceLabel: string; // "Starting bid" | "List price" | "Price" | "Asking"
  kind: HousingPriceKind;
  /** True for auction stock (number is a minimum/opening bid that will rise). */
  isAuction: boolean;
}

const AUCTION_RX =
  /auction|surplus|municibid|govdeals|allsurplus|gsa|sheriff|tax[_-]?sale|foreclosure/i;

/**
 * Channel-correct price wording for a housing listing. Keys off the source first, then falls back to the
 * presence of an auction deadline. Defaults to "Asking" for ordinary listings.
 */
export function housingPriceTerms(
  source?: string | null,
  hasAuctionEnd?: boolean,
): HousingPriceTerms {
  const s = (source || "").toLowerCase();
  // Off-market owner lead (tax-delinquent etc.) — not for sale; the number shown is the assessed value.
  if (s === "absentee_owner")
    return { priceLabel: "Assessed value", kind: "list", isAuction: false };
  if (s === "mls" || s === "redfin")
    return { priceLabel: "List price", kind: "list", isAuction: false };
  // Sold comps (Redfin gis past-sales) — the number is a CLOSED sale price, valuation anchor not a deal.
  if (s === "redfin_sold")
    return { priceLabel: "Sold price", kind: "list", isAuction: false };
  if (s === "hud_reo" || s === "fannie_homepath")
    return { priceLabel: "REO — bank-owned", kind: "list", isAuction: false };
  if (s === "foreclosure")
    return { priceLabel: "Foreclosure", kind: "list", isAuction: false };
  if (s === "dangerous_building" || s === "vacant_building")
    return { priceLabel: "Off-market", kind: "list", isAuction: false };
  if (
    s === "tax_delinquent" ||
    s.includes("delinquent") ||
    s === "code_violation"
  )
    return { priceLabel: "Assessed value", kind: "list", isAuction: false };
  if (AUCTION_RX.test(s))
    return { priceLabel: "Starting bid", kind: "auction", isAuction: true };
  if (s === "hud")
    return { priceLabel: "List price", kind: "list", isAuction: false };
  if (s === "land_bank" || s.includes("land"))
    return { priceLabel: "Price", kind: "list", isAuction: false };
  if (hasAuctionEnd)
    return { priceLabel: "Starting bid", kind: "auction", isAuction: true };
  return { priceLabel: "Asking", kind: "asking", isAuction: false };
}
