import * as dotenv from "dotenv";

async function run() {
  dotenv.config({ path: ".env.local" });
  console.log(
    "Env loaded, NEXT_PUBLIC_SUPABASE_URL:",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  const { checkAlerts } = await import("../lib/alerts/alert-engine");
  console.log("Starting alert engine check...");
  await checkAlerts();
  console.log("Done.");
}

run();
