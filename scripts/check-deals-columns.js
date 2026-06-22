const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('deals').select('*').limit(1);
  if (error) {
    console.log("Error:", error);
  } else if (data && data.length > 0) {
    console.log("Deals columns:", Object.keys(data[0]));
  } else {
    console.log("Deals is empty, unable to infer schema from select *.");
  }
}
main();
