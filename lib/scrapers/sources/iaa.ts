import * as cheerio from 'cheerio';
import axios from 'axios';
import { getWorkingProxy } from '../tools/free-proxy-manager';
import { enrichAndStore } from './shared';

export async function scrapeIAA(searchTerm = '', limit = 100) {
  const proxy = await getWorkingProxy();
  const url = `https://www.iaai.com/Search?SearchSpec=${encodeURIComponent(searchTerm)}&sortBy=saleDate&sortOrder=asc`;
  
  const config: any = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.iaai.com/',
    },
    timeout: 20000,
  };
  
  if (proxy) {
    config.proxy = { host: proxy.split(':')[0], port: parseInt(proxy.split(':')[1]) };
  }
  
  const res = await axios.get(url, config);
  const $ = cheerio.load(res.data);
  const vehicles: any[] = [];
  
  // IAA uses both old and new layouts — handle both
  const selectors = [
    '[data-lot-number]',
    '.lot-details-container',
    '.search-result-card',
  ];
  
  for (const selector of selectors) {
    if ($(selector).length > 0) {
      $(selector).each((_, el) => {
        const lotNum = $(el).attr('data-lot-number') || 
                       $(el).find('[data-lot-number]').attr('data-lot-number') || 
                       String(Date.now() + Math.random());
        
        const priceText = $(el).find('.bid-price, .current-bid, [class*="price"]').first().text();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
        
        const odometerText = $(el).find('.odometer, [data-odometer], [class*="mileage"]').first().text();
        const odometer = parseInt(odometerText.replace(/[^0-9]/g, '')) || 0;
        
        const href = $(el).find('a').attr('href') || '';
        
        if (price > 0 || href.includes('lot')) {
          vehicles.push({
            source: 'iaa',
            source_category: 'salvage',
            external_id: lotNum,
            title: $(el).find('.lot-title, .vehicle-title, h2, h3').first().text().trim(),
            vin: $(el).find('[data-vin], .vin').first().text().trim() || $(el).attr('data-vin') || '',
            current_bid: price,
            asking_price: price,
            odometer,
            damage_type: $(el).find('.damage-description, .primary-damage, [class*="damage"]').first().text().trim(),
            title_type: $(el).find('.title-type, [class*="title-type"]').first().text().trim().toLowerCase() || 'salvage',
            location_city: $(el).find('.location-city, [class*="city"]').first().text().trim(),
            location_state: $(el).find('.location-state, [class*="state"]').first().text().trim(),
            sale_date: $(el).find('.sale-date, [class*="sale-date"]').first().text().trim(),
            images: $(el).find('img').map((_, img) => $(img).attr('src') || $(img).attr('data-src')).get().filter(src => src && src.startsWith('http')),
            listing_url: href.startsWith('http') ? href : `https://www.iaai.com${href}`,
          });
        }
      });
      break; // Found a working selector, stop
    }
  }
  
  // Enrich each vehicle and store in Supabase
  for (const v of vehicles.slice(0, limit)) {
    await enrichAndStore(v);
  }
  
  return vehicles.length;
}
