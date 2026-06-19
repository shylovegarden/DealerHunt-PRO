chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape') {
    scrapeAndSend().then(success => {
      sendResponse({ success });
    });
    return true; // Keep the message channel open for async response
  }
});

async function scrapeAndSend() {
  try {
    const url = window.location.href;
    let data = { url, source: 'unknown' };

    if (url.includes('facebook.com/marketplace')) {
      data = { ...data, ...scrapeFacebook() };
    } else if (url.includes('copart.com/lot')) {
      data = { ...data, ...scrapeCopart() };
    }

    if (!data.title || !data.price) {
      console.error('DealerHunt Scraper: Failed to extract title or price', data);
      // Fallback for testing on random pages if we want it to work on any page:
      data.title = document.title;
      data.price = '$5,000'; // mock price
    }

    // Send to localhost API (DealerHunt)
    const response = await fetch('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    console.log('DealerHunt API Response:', result);
    return result.success || result.warning;
  } catch (error) {
    console.error('Scrape error:', error);
    return false;
  }
}

function scrapeFacebook() {
  // Heuristics for FB Marketplace
  let title = document.querySelector('h1')?.innerText || '';
  
  // Find price (first text containing $)
  let price = '';
  const spans = Array.from(document.querySelectorAll('span'));
  for (let span of spans) {
    if (span.innerText && span.innerText.includes('$') && span.innerText.length < 15) {
      price = span.innerText;
      break;
    }
  }

  // Find main image
  let image_url = '';
  const img = document.querySelector('img[src*="scontent"]');
  if (img) image_url = img.src;

  // External ID from URL
  const match = window.location.pathname.match(/\\/item\\/(\\d+)/);
  const external_id = match ? match[1] : `fb_${Date.now()}`;

  return {
    source: 'facebook',
    title,
    price,
    image_url,
    external_id,
    description: 'Scraped from Facebook Marketplace'
  };
}

function scrapeCopart() {
  // Heuristics for Copart
  let title = document.querySelector('h1')?.innerText || '';
  let price = document.querySelector('.current-bid, .buy-it-now-price, span[ng-bind="lotDetails.bidInfo.currentBid"]')?.innerText || '$0';
  let image_url = document.querySelector('.img-responsive, img')?.src || '';
  
  const match = window.location.pathname.match(/\\/lot\\/(\\d+)/);
  const external_id = match ? match[1] : `copart_${Date.now()}`;

  return {
    source: 'copart',
    title,
    price,
    image_url,
    external_id,
    description: 'Scraped from Copart'
  };
}
