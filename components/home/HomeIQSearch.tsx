"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveSearchScope } from "@/lib/housing/zip-state";

// The city/ZIP front door — type a city, ZIP, "City, ST", or a state and land exactly there (instead of
// being forced to pick a whole state first). Resolves client-side and routes to the scoped leads list.
export function HomeIQSearch({ big = false }: { big?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const scope = resolveSearchScope(q);
    const params = new URLSearchParams();
    if (scope.state) params.set("state", scope.state);
    if (scope.q) params.set("q", scope.q);
    router.push(`/homeiq/leads?${params.toString()}`);
  }

  return (
    <form
      onSubmit={go}
      className={`flex items-stretch gap-2 ${big ? "max-w-xl" : "max-w-md"} w-full`}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a city, ZIP, or address…"
        className={`flex-1 min-w-0 rounded-[var(--r3)] bg-[var(--s0)] border border-[var(--b1)] text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:border-[var(--home-bd)] ${
          big ? "px-5 py-3.5 text-base" : "px-4 py-2.5 text-sm"
        }`}
        aria-label="Search city, ZIP, or address"
      />
      <button
        type="submit"
        className={`shrink-0 rounded-[var(--r3)] font-black text-black ${
          big ? "px-6 py-3.5 text-base" : "px-5 py-2.5 text-sm"
        }`}
        style={{ background: "var(--grad-home)" }}
      >
        Search
      </button>
    </form>
  );
}
