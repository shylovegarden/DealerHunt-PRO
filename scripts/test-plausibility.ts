// One-off: verify the price-plausibility gate flips bait listings to verdict "pass".
import { createClient } from "@supabase/supabase-js";
import { analyzeDeal } from "../lib/scoring/deal-analyzer";
import { loadMarketIndex } from "../lib/scoring/market-value";
import { config } from "dotenv";
config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  await loadMarketIndex(sb);
  // Pull current GO deals under $2k (the suspected bait) + a control set of legit GO deals.
  const { data: bait } = await sb
    .from("deals")
    .select("*")
    .eq("active", true)
    .eq("deal_verdict", "go")
    .lt("ask_price", 2000)
    .limit(200);
  const { data: legit } = await sb
    .from("deals")
    .select("*")
    .eq("active", true)
    .eq("deal_verdict", "go")
    .gte("ask_price", 4000)
    .limit(200);

  let flipped = 0;
  for (const d of bait || []) {
    const a = analyzeDeal(d as any);
    if (a.priceImplausible) flipped++;
  }
  let falsePos = 0;
  const examples: string[] = [];
  for (const d of legit || []) {
    const a = analyzeDeal(d as any);
    if (a.priceImplausible) {
      falsePos++;
      if (examples.length < 8)
        examples.push(
          `  $${d.ask_price} ${d.year} ${d.make} ${d.model} — "${(d.title || "").slice(0, 50)}"`,
        );
    }
  }
  console.log(
    `bait set (GO, <$2k): ${bait?.length} deals, ${flipped} now flagged implausible (→ pass)`,
  );
  console.log(
    `control set (GO, ≥$4k): ${legit?.length} deals, ${falsePos} flagged implausible (false positives)`,
  );
  if (examples.length)
    console.log("false-positive examples:\n" + examples.join("\n"));
}
main().then(() => process.exit(0));
