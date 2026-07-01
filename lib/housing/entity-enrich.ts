// lib/housing/entity-enrich.ts
//
// Batch owner-contact enrichment for LLC-owned properties via free state business registries (biz-registry).
// Registry data is static, so we check each LLC-owned property once (hottest-first) and store the real
// contact + address into signals. Bounded + best-effort; MERGES signals (never clobbers).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lookupEntityContact, registryStates } from "./sources/biz-registry";

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );
}

async function pooled<T>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

interface Row {
  id: string;
  state: string | null;
  signals: Record<string, unknown> | null;
}

/**
 * Enrich a bounded batch of not-yet-checked LLC-owned properties (in registry-covered states, hottest first)
 * with the owner's real contact + address. Returns the count that got a contact. 0 / no-op on any failure.
 */
export async function enrichEntityContacts(limit = 400): Promise<number> {
  try {
    const states = registryStates();
    if (!states.length) return 0;
    const sb = service();
    const { data, error } = await sb
      .from("properties")
      .select("id, state, signals")
      .eq("active", true)
      .in("state", states)
      .ilike("signals->>owner", "%LLC%")
      .filter("signals->>entity_checked", "is", null)
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error || !data?.length) return 0;

    let found = 0;
    await pooled(data as Row[], 8, async (r) => {
      const owner = (r.signals as any)?.owner as string | undefined;
      const contact = await lookupEntityContact(owner, r.state).catch(
        () => null,
      );
      // Always mark checked (registry is static — a miss won't become a hit); store the contact on a hit.
      const merged: Record<string, unknown> = {
        ...(r.signals || {}),
        entity_checked: true,
      };
      if (contact) {
        merged.entity_contact = contact;
        found++;
      }
      await sb.from("properties").update({ signals: merged }).eq("id", r.id);
    });
    console.log(`[entity] contacts found ${found}/${data.length}`);
    return found;
  } catch (e) {
    console.warn("[entity] enrich skipped:", (e as Error).message);
    return 0;
  }
}
