"use client";

import useSWR from "swr";

// Cross-app view preferences (HomeIQ + DealerHunt). Reads /api/preferences (RLS-scoped to the user) and
// gives an optimistic `save(patch)` that merges. Used by the settings pages and by the leads pages to land
// the user on their preferred state without re-picking each visit.

export interface Prefs {
  homeiqState?: string; // default state to view in HomeIQ leads
  homeiqStates?: string[]; // multi-state "hunt list" — the set of states you actively work
  homeiqTier?: string; // default tier filter ("", "hot", "warm")
  homeiqType?: string; // default property type ("", "single_family", ...)
  homeiqMaxPrice?: number; // default max-price cap (0 = none)
  homeiqHideInstitutional?: boolean; // default: hide portfolio/institutional owners (>=5 properties)
  carsState?: string; // default state to view in DealerHunt
  carsStates?: string[]; // multi-state "hunt list" for cars
  preferredVertical?: string; // "homeiq" | "cars" — which app to land on
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function usePreferences() {
  const { data, mutate, isLoading } = useSWR<
    { prefs: Prefs } | { error: string }
  >("/api/preferences", fetcher, { revalidateOnFocus: false });

  const prefs: Prefs = data && "prefs" in data ? data.prefs : {};
  const authed = !(data && "error" in (data as any));

  const save = async (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    mutate({ prefs: next }, false); // optimistic
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
    } finally {
      mutate();
    }
    return next;
  };

  return { prefs, save, authed, isLoading };
}
