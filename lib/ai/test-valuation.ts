import { predictVehicleValuation } from './agents/valuation-agent';

async function runTest() {
  const sampleVehicle = {
    make: 'Ford',
    model: 'F-150 XLT SuperCrew 4x4',
    year: 2018,
    mileage: 65432,
    condition: 'run_drive',
    ask_price: 26500,
    location_state: 'FL'
  };
  
  console.log('Testing AI Valuation Agent...');
  console.log('Vehicle Input:', sampleVehicle);
  
  try {
    const result = await predictVehicleValuation(sampleVehicle);
    
    console.log('\n✅ Valuation Successful! Result:');
    console.log(JSON.stringify(result, null, 2));
    
    const profitMargin = result.estimatedWholesalePrice - sampleVehicle.ask_price;
    console.log(`\n💰 Est. Profit Margin: $${profitMargin}`);
    
  } catch (error) {
    console.error('\n❌ Valuation Failed:', error);
  }
}

// To run this:
// export GOOGLE_GENERATIVE_AI_API_KEY="your_api_key"
// npx ts-node lib/ai/test-valuation.ts
runTest();
