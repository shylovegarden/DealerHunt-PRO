// scripts/backfill-embeddings.ts
// One-shot embedding backfill — embeds every active deal that lacks a vector, in batches, until
// done. Use it to warm semantic similarity immediately instead of waiting for the 2-hourly cron.
//
//   1. Pull prod env locally (so SUPABASE_* + GOOGLE_GENERATIVE_AI_API_KEY are present):
//        vercel env pull .env.local
//   2. Run:
//        npx tsx scripts/backfill-embeddings.ts
//
// Safe to re-run; it only touches deals where embedding IS NULL.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  backfillEmbeddings,
  hasEmbeddingProvider,
} from "../lib/ai/deal-embeddings";

async function main() {
  if (!hasEmbeddingProvider()) {
    console.error(
      "GOOGLE_GENERATIVE_AI_API_KEY not set — run `vercel env pull .env.local` first.",
    );
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Supabase env missing.");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  let total = 0;
  for (let round = 1; ; round++) {
    const { updated, remaining, skipped } = await backfillEmbeddings(
      supabase,
      100,
    );
    if (skipped) break;
    total += updated;
    console.log(
      `round ${round}: +${updated} embedded · ${remaining} remaining (total ${total})`,
    );
    if (updated === 0 || remaining === 0) break;
  }
  console.log(`Done. Embedded ${total} deals.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
