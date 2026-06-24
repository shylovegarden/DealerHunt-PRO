import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cachePhotos() {
  // Fetch top deals by profit score that need photos cached
  const { data: deals } = await supabase
    .from("deals")
    .select("id, images, profit_score")
    .eq("active", true)
    .not("images", "is", null)
    .gte("profit_score", 70)
    .not("images", "cs", '{"https://supabase"}') // not already cached
    .order("profit_score", { ascending: false })
    .limit(500);

  if (!deals?.length) {
    console.log("No deals to cache");
    return;
  }

  console.log(`Caching photos for ${deals.length} deals...`);

  for (const deal of deals) {
    const newUrls: string[] = [];
    const oldUrls: string[] = deal.images || [];

    for (let i = 0; i < Math.min(oldUrls.length, 5); i++) {
      // max 5 photos per deal
      const url = oldUrls[i];
      if (!url || url.includes("supabase")) {
        newUrls.push(url);
        continue;
      }

      try {
        const res = await fetch(url, {
          headers: {
            Referer: "https://craigslist.org",
            "User-Agent": "Mozilla/5.0",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;

        const buffer = await res.arrayBuffer();
        const ext = url.includes(".png") ? "png" : "jpg";
        const path = `${deal.id}/${i}.${ext}`;

        const { error } = await supabase.storage
          .from("deal-photos")
          .upload(path, buffer, {
            contentType: `image/${ext}`,
            upsert: true,
          });

        if (!error) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("deal-photos").getPublicUrl(path);
          newUrls.push(publicUrl);
        }
      } catch (e) {
        console.error(`Failed ${deal.id} img ${i}:`, e);
      }
    }

    if (newUrls.length > 0) {
      await supabase
        .from("deals")
        .update({ images: newUrls })
        .eq("id", deal.id);
      console.log(`✓ Deal ${deal.id}: ${newUrls.length} photos cached`);
    }

    // Rate limit: be nice
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("Done!");
}

cachePhotos();
