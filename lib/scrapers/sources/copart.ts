import * as cheerio from 'cheerio';
import { fetchWithCloudflareBypass } from '../tools/cloudflare-bypass';
import { enrichAndStore } from './shared';

export async function scrapeCopart(searchTerm = '', state = '') {
  // Copart requires Cloudflare bypass — must have FlareSolverr running
  const url = `https://www.copart.com/vehicleFinderSearch?query=${encodeURIComponent(searchTerm)}${state ? `&state=${state}` : ''}`;
  
  let html: string;
  try {
    html = await fetchWithCloudflareBypass(url);
  } catch (e) {
    console.error('[Copart] FlareSolverr not available:', e);
    // Fallback: try to intercept their API
    return await scrapeCopartAPI(searchTerm, state);
  }
  
  const $ = cheerio.load(html);
  const vehicles: any[] = [];
  
  // Copart renders via React — look for JSON in script tags
  $('script').each((_, el) => {
    const content = $(el).html() || '';
    if (content.includes('"lotNumberStr"')) {
      try {
        // Extract the JSON data Copart embeds in the page
        const jsonMatch = content.match(/window\.__INITIAL_STATE__\s*=\s*({.+});/);
        if (jsonMatch) {
          const state = JSON.parse(jsonMatch[1]);
          const lots = state?.vehicleFinderSearch?.data?.results?.content || [];
          lots.forEach((lot: any) => {
            vehicles.push({
              source: 'copart',
              source_category: 'salvage',
              external_id: String(lot.lotNumberStr || lot.ln),
              vin: lot.vin || '',
              year: lot.lcy || lot.y,
              make: lot.mkn || lot.mk,
              model: lot.mdn || lot.md,
              trim: lot.tmtp || '',
              odometer: lot.orr || lot.od || 0,
              damage_type: lot.dmg || lot.dd || '',
              title_type: (lot.ttle || 'salvage').toLowerCase(),
              current_bid: lot.hb || 0,
              asking_price: lot.hb || 0,
              location_city: lot.yn || lot.yard?.name || '',
              location_state: lot.saleState || lot.st || '',
              sale_date: lot.saleDate || '',
              images: lot.imgs?.map((img: any) => img.url || img) || [],
              listing_url: `https://www.copart.com/lot/${lot.lotNumberStr || lot.ln}`,
            });
          });
        }
      } catch {}
    }
  });
  
  for (const v of vehicles) {
    await enrichAndStore(v);
  }
  
  return vehicles.length;
}

// Fallback: hit Copart's internal search API directly
async function scrapeCopartAPI(searchTerm: string, state: string) {
  // Copart has an internal GraphQL/REST API — intercept it
  const res = await fetch('https://www.copart.com/public/lots/search-results', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://www.copart.com/',
    },
    body: JSON.stringify({
      query: searchTerm,
      filters: { state: state ? [state] : [] },
      sort: 'saleDate',
      size: 100,
    }),
  });
  
  if (!res.ok) {
    console.error('[Copart API] Failed:', res.status);
    return 0;
  }
  
  const data = await res.json();
  // Parse and store results
  return data?.data?.results?.content?.length || 0;
}
