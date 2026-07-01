"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, Map as MapIcon, BarChart3, Bookmark } from "lucide-react";

// Mobile bottom tab bar for HomeIQ — the housing twin of the cars BottomNav. 5 core tabs, teal active state.
const NAV_ITEMS = [
  { name: "Home", href: "/homeiq", icon: Home },
  { name: "Leads", href: "/homeiq/leads", icon: List },
  { name: "States", href: "/homeiq/states", icon: MapIcon },
  { name: "Market", href: "/homeiq/market", icon: BarChart3 },
  { name: "Pipeline", href: "/homeiq/saved", icon: Bookmark },
];

export function HousingBottomNav() {
  const pathname = usePathname() || "";
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: "var(--s0)",
        borderTop: "1px solid var(--b1)",
        boxShadow: "0 -4px 20px rgba(0,0,0,.18)",
        height: "calc(56px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/homeiq/leads" &&
            pathname.startsWith("/homeiq/leads"));
        return (
          <Link
            key={item.name}
            href={item.href}
            className="flex flex-1 flex-col items-center justify-center gap-1 transition-all"
            style={{ color: active ? "var(--home)" : "var(--t4)" }}
          >
            <item.icon
              style={{
                width: 22,
                height: 22,
                strokeWidth: active ? 2.5 : 1.75,
                transition: "all 150ms ease",
                transform: active ? "translateY(-1px)" : "none",
              }}
            />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: active ? 700 : 600,
                letterSpacing: "0.02em",
              }}
            >
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
