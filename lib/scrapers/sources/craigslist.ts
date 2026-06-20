import * as cheerio from 'cheerio';
import axios from 'axios';
import { getWorkingProxy } from '../tools/free-proxy-manager';
import { enrichAndStore } from './shared';

const CL_CITIES = [
  'dallas','houston','miami','chicago','losangeles','newyork','atlanta',
  'phoenix','seattle','denver','boston','detroit','nashville','charlotte',
  'portland','lasvegas','orlando','tampa','minneapolis','stlouis',
  'sandiego','sanantonio','austin','columbus','indianapolis','raleigh',
  'baltimore','pittsburgh','milwaukee','saltlakecity','albuquerque',
  'memphis','louisville','richmond','neworleans','tulsa','wichita',
  'omaha','kansascity','jacksonville','fortworth','sacramento','fresno',
];

export async function scrapeCraigslist(searchTerm = 'cars trucks', cities = CL_CITIES) {
  let totalFound = 0;
  
  for (const city of cities) {
    try {
      const proxy = await getWorkingProxy();
      const url = `https://${city}.craigslist.org/search/cto?query=${encodeURIComponent(searchTerm)}&sort=rel`;
      
      const config: any = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        timeout: 12000,
      };
      
      if (proxy) {
        config.proxy = { host: proxy.split(':')[0], port: parseInt(proxy.split(':')[1]) };
      }
      
      const res = await axios.get(url, config);
      const $ = cheerio.load(res.data);
      const listings: any[] = [];
      
      // Handle both old and new CL layouts
      $('li.cl-static-search-result, .result-row').each((_, el) => {
        const price = parseInt(
          $(el).find('.priceinfo, .result-price').first().text().replace(/[^0-9]/g, '')
        );
        const title = $(el).find('.cl-app-anchor, .result-title').attr('title') || 
                      $(el).find('.result-title').text().trim();
        const href = $(el).find('a').first().attr('href') || '';
        const pid = $(el).attr('data-pid') || href.match(/\/(\d+)\.html/)?.[1] || '';
        
        if (price > 500 && price < 200000 && title) {
          listings.push({
            source: 'craigslist',
            source_category: 'private',
            external_id: pid || String(Date.now() + Math.random()),
            title,
            asking_price: price,
            current_bid: price,
            location_city: city,
            location_state: getCLStateFromCity(city),
            listing_url: href.startsWith('http') ? href : `https://${city}.craigslist.org${href}`,
            images: [],
          });
        }
      });
      
      for (const listing of listings) {
        await enrichAndStore(listing);
      }
      
      totalFound += listings.length;
      
      // Rate limit: 1-2 second delay between cities
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
      
    } catch (e) {
      console.error(`[CL] ${city} failed:`, (e as Error).message);
    }
  }
  
  return totalFound;
}

function getCLStateFromCity(city: string): string {
  const map: Record<string, string> = {
    dallas:'TX', houston:'TX', sanantonio:'TX', austin:'TX', fortworth:'TX',
    miami:'FL', orlando:'FL', tampa:'FL', jacksonville:'FL',
    chicago:'IL', nashville:'TN', memphis:'TN', atlanta:'GA', charlotte:'NC',
    raleigh:'NC', phoenix:'AZ', lasvegas:'NV', losangeles:'CA', sandiego:'CA',
    sacramento:'CA', fresno:'CA', seattle:'WA', portland:'OR', denver:'CO',
    saltlakecity:'UT', albuquerque:'NM', boston:'MA', newyork:'NY',
    brooklyn:'NY', detroit:'MI', columbus:'OH', indianapolis:'IN',
    minneapolis:'MN', stlouis:'MO', kansascity:'MO', omaha:'NE',
    wichita:'KS', tulsa:'OK', louisville:'KY', richmond:'VA',
    baltimore:'MD', pittsburgh:'PA', milwaukee:'WI', neworleans:'LA',
  };
  return map[city] || 'US';
}
