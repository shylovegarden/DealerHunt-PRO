import { createPatchrightBrowser } from '../tools/patchright-engine';

async function traceCopart() {
  console.log('Tracing Copart network requests...');
  const { browser, page } = await createPatchrightBrowser();
  
  try {
    // Log all XHR/Fetch requests to find the JSON API
    page.on('response', async (response) => {
      const type = response.request().resourceType();
      const url = response.url();
      if (type === 'fetch' || type === 'xhr') {
        console.log(`[XHR] ${url}`);
        if (url.includes('graphql') || url.includes('search') || url.includes('vehicleFinder')) {
          try {
            const body = await response.text();
            console.log(`      -> Response size: ${body.length} bytes`);
            if (body.includes('lotNumber') || body.includes('vin')) {
              console.log(`      -> 🚨 FOUND THE CAR DATA ENDPOINT!`);
            }
          } catch (e) {
            // Ignore body read errors
          }
        }
      }
    });

    const url = 'https://www.copart.com/vehicleFinderSearch?query=F-150&state=TX';
    console.log(`Navigating to ${url}...`);
    
    // Wait for network idle to ensure all XHRs finish
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded completely.');
    
  } catch (error) {
    console.error('Error during trace:', error);
  } finally {
    await browser.close();
  }
}

traceCopart().then(() => process.exit(0)).catch(() => process.exit(1));
