import { scrapeCopart } from '../sources/copart';

async function run() {
  console.log('Automating Chrome Playwright (Patchright)...');
  console.log('Attempting to bypass Cloudflare and scrape Copart for "F-150" in Texas (TX)...');
  
  const results = await scrapeCopart('F-150', 'TX');
  
  const fs = require('fs');
  const html = await require('../tools/patchright-engine').fetchWithPatchright('https://www.copart.com/vehicleFinderSearch?query=F-150&state=TX');
  fs.writeFileSync('copart-debug.html', html);
  
  console.log(`\n✅ Success! Scraped ${results} F-150 vehicles from Copart in TX.`);
  console.log('The headless Chromium browser was successfully managed by Patchright.');
  process.exit(0);
}

run().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
