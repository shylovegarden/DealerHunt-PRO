import { createClient, SupabaseClient } from "@supabase/supabase-js";

function assertEnv() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_PROJECT_ID")
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured. Set it in .env.local",
    );
  }
}

export function getSupabaseClient(): SupabaseClient {
  assertEnv();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

import { createBrowserClient } from "@supabase/ssr";

export function createClientComponentClient(): SupabaseClient {
  assertEnv();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function createServerComponentClient(): SupabaseClient {
  assertEnv();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// Legacy named export — call this instead of using `supabase` directly
// Use createClientComponentClient() or createServerComponentClient() where possible.
export function getSupabase(): SupabaseClient {
  return getSupabaseClient();
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes("YOUR_PROJECT_ID"));
}
