"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Car } from "lucide-react";

// Always-visible Houses ⇄ Cars switch. The two verticals were only reachable behind an unlabeled avatar
// menu — no one would find them. This segmented toggle sits next to the logo on BOTH top navs and at EVERY
// viewport (icon-only on phones, icon+label from sm up), brand-colored so the active app is obvious: teal
// for HomeIQ, warm for DealerHunt. Path-aware; tapping the inactive side navigates.
export function VerticalSwitch() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const inHouses = pathname.startsWith("/homeiq");

  return (
    <div
      role="tablist"
      aria-label="Switch between Houses and Cars"
      className="flex items-center p-0.5 rounded-full border border-[var(--b1)] bg-[var(--s0)] shrink-0"
    >
      <button
        role="tab"
        aria-selected={inHouses}
        onClick={() => !inHouses && router.push("/homeiq")}
        title="Houses — HomeIQ"
        className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold transition-colors"
        style={
          inHouses
            ? { background: "var(--grad-home)", color: "#04201d" }
            : { color: "var(--t4)" }
        }
      >
        <Home style={{ width: 13, height: 13 }} strokeWidth={2.5} />
        <span className="hidden sm:inline">Houses</span>
      </button>
      <button
        role="tab"
        aria-selected={!inHouses}
        onClick={() => inHouses && router.push("/discover")}
        title="Cars — DealerHunt Pro"
        className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold transition-colors"
        style={
          !inHouses
            ? { background: "var(--grad)", color: "#fff" }
            : { color: "var(--t4)" }
        }
      >
        <Car style={{ width: 13, height: 13 }} strokeWidth={2.5} />
        <span className="hidden sm:inline">Cars</span>
      </button>
    </div>
  );
}
