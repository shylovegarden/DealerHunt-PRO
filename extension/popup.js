document.getElementById('scrapeBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Scraping...';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'scrape' }, (response) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = 'Error: Please open a Facebook Marketplace or Copart listing.';
        return;
      }
      
      if (response && response.success) {
        statusEl.textContent = '✅ Sent to DealerHunt!';
      } else {
        statusEl.textContent = '❌ Failed to send.';
      }
    });
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
  }
});
