// lib/deal-terms.ts
// Buy-side terminology that matches the channel: you BID at an auction, but you make an OFFER against
// a retail/private ASKING price. Saying "max bid" on a Carvana or Craigslist car is just wrong — so
// the UI labels (and the recommended buy number) adapt to the source.

const AUCTION_SOURCES = new Set([
  "copart",
  "iaa",
  "adesa",
  "manheim",
  "acv",
  "gov_auction", // PublicSurplus + other gov surplus auctions
]);

/** True when the source is a live auction (you place a BID), not a fixed/asking-price listing. */
export function isAuctionSource(source?: string | null): boolean {
  return AUCTION_SOURCES.has((source || "").toLowerCase().trim());
}

/** Channel-appropriate buy terminology for labels/copy. */
export function buyTerm(source?: string | null): {
  /** "Max bid" (auction) | "Max offer" (asking-price listing) */
  label: string;
  /** "bid" | "offer" — for sentences */
  verb: string;
  /** what the seller's listed number represents */
  priceLabel: string;
} {
  return isAuctionSource(source)
    ? { label: "Max bid", verb: "bid", priceLabel: "Current bid" }
    : { label: "Max offer", verb: "offer", priceLabel: "Asking price" };
}
