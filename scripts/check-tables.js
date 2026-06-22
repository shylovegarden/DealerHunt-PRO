const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('get_schema_info'); // doesn't exist
  // Let's just fetch 1 row from dealers
  const { data: dealers, error: err } = await supabase.from('dealers').select('*').limit(1);
  console.log("Dealers schema sample:", dealers);
  console.log("Error:", err);
}
main();
