export function scorePrivateLead(listing: {
  daysListed: number;
  priceDropCount: number;
  description: string;
  askPrice: number;
  marketValue: number;
}) {
  let score = 50; // base
  
  // Days listed: longer = more motivated seller
  if (listing.daysListed > 30) score += 20;
  else if (listing.daysListed > 14) score += 10;
  else if (listing.daysListed > 7) score += 5;
  
  // Price drops: dropped = motivated
  score += Math.min(20, listing.priceDropCount * 8);
  
  // Keywords indicating motivation
  const urgent = ['must sell', 'moving', 'divorce', 'estate', 'quick sale', 'motivated', 'make offer', 'obo', 'or best offer', 'need gone'];
  const desc = listing.description.toLowerCase();
  if (urgent.some(k => desc.includes(k))) score += 15;
  
  // Priced below market = motivated or eager
  const discount = (listing.marketValue - listing.askPrice) / listing.marketValue;
  if (discount > 0.2) score += 15;
  else if (discount > 0.1) score += 8;
  
  return Math.min(100, score);
}
