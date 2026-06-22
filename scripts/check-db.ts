import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars:", { supabaseUrl, supabaseKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Connecting to:", supabaseUrl);

  const tables = [
    "saved_cars",
    "vin_price_history",
    "market_aggregates",
    "user_profiles",
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.log(`❌ Table "${table}" check failed:`, error.message);
    } else {
      console.log(`✅ Table "${table}" check successful!`);
    }
  }
}

check();
