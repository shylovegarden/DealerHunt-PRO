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

async function run() {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .limit(1);
  if (!profiles || profiles.length === 0) {
    console.error("No profiles found in DB!");
    return;
  }
  const profile = profiles[0];
  console.log("Using profile user ID:", profile.id);

  // Clear existing alerts to prevent spam
  await supabase.from("alerts").delete().eq("user_id", profile.id);

  // Insert mock alert
  const alert = {
    user_id: profile.id,
    name: "Silverado 1500 Alert",
    type: "new_listing",
    channels: ["email"],
    filters: {
      make: "Chevrolet",
      model: "Silverado",
      max_price: 15000,
      min_profit: 0,
      states: ["TX", "CA"],
    },
    active: true,
  };

  const { data, error } = await supabase
    .from("alerts")
    .insert(alert)
    .select()
    .single();
  if (error) {
    console.error("Error inserting alert:", error.message);
  } else {
    console.log("Inserted mock alert:", data);
  }
}

run();
