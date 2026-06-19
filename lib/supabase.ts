import { createClient, SupabaseClient } from '@supabase/supabase-js'

// All clients are created lazily (on first call, not at module import time).
// This prevents Next.js build-time crashes when env vars are absent.

export function getSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createClientComponentClient(): SupabaseClient {
  return getSupabaseClient()
}

export function createServerComponentClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Legacy named export — call this instead of using `supabase` directly
// Use createClientComponentClient() or createServerComponentClient() where possible.
export function getSupabase(): SupabaseClient {
  return getSupabaseClient()
}
