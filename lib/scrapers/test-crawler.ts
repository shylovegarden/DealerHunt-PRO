import { crawlInventoryAndQueueVDPs } from './ai-crawler';

async function runTest() {
  // Replace this with a real local independent dealer website
  const sampleDealerUrl = 'https://www.example-dealer.com/inventory';
  
  console.log(`Starting advanced AI crawler test on: ${sampleDealerUrl}`);
  
  try {
    const queuedCount = await crawlInventoryAndQueueVDPs(sampleDealerUrl);
    console.log(`\n✅ Test complete! Successfully identified and queued ${queuedCount} VDPs.`);
    console.log('Ensure your Redis server is running and the Bull worker is listening to process these items.');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// To run this:
// export GOOGLE_GENERATIVE_AI_API_KEY="your_api_key"
// npx ts-node lib/scrapers/test-crawler.ts
runTest();
