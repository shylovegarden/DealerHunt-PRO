import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
}

export async function getServerUser() {
  const supabase = await serverClient();
  return supabase.auth.getUser();
}

/** User + their "land on" preference (preferredVertical: "cars" | "homeiq" | null) in one round-trip, so
 *  the root landing can honor the setting instead of always showing the vertical selector. */
export async function getServerUserAndVertical(): Promise<{
  userId: string | null;
  preferredVertical: string | null;
}> {
  const supabase = await serverClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return { userId: null, preferredVertical: null };
  const { data: p } = await supabase
    .from("user_preferences")
    .select("prefs")
    .eq("user_id", data.user.id)
    .maybeSingle();
  const pv = (p?.prefs as { preferredVertical?: string } | null)
    ?.preferredVertical;
  return { userId: data.user.id, preferredVertical: pv || null };
}
