import { extractVehicleDataFromText } from './agents/scraper-agent';

const rawDealerWebsiteText = `
  2018 Ford F-150 XLT SuperCrew 4x4
  Price: $26,500
  Odometer: 65,432 miles
  VIN: 1FTFW1E8XJFC12345
  
  Features:
  - 5.0L V8 Engine
  - 10-Speed Automatic Transmission
  - Sync 3 with Apple CarPlay
  - Heated Front Seats
  - Backup Camera
  
  Exterior: Oxford White
  Interior: Medium Earth Gray
  Condition: Runs perfectly, minor scratches on the bed.
  
  Contact DealerHunt Motors today to test drive this amazing truck!
`;

async function runTest() {
  console.log('Testing AI Scraper Agent...');
  console.log('--- Raw Text Input ---');
  console.log(rawDealerWebsiteText);
  console.log('----------------------');
  
  try {
    const result = await extractVehicleDataFromText(rawDealerWebsiteText);
    
    console.log('\n✅ Extraction Successful! Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Extraction Failed:', error);
  }
}

// To run this:
// export GOOGLE_GENERATIVE_AI_API_KEY="your_api_key"
// npx ts-node lib/ai/test-scraper.ts
runTest();
