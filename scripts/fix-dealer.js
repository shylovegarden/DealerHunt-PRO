const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'stlecurepair@gmail.com');
  
  if (user) {
    const { data: newDealer, error: insertErr } = await supabase.from('dealers').insert({
      user_id: user.id,
      name: "Stlecu Repair"
    }).select().single();
    if (insertErr) console.log(insertErr);
    else console.log("Created dealer for testing!");
  }
}
main();
