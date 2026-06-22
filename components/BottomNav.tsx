"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map,
  Search,
  Bookmark,
  Truck,
  Clock,
  Wallet,
  Wrench,
  Compass,
  Layers,
  TrendingUp,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Discover", href: "/discover", icon: Compass },
  { name: "Find", href: "/find", icon: Map },
  { name: "Scan", href: "/scan", icon: Search },
  { name: "Bulk", href: "/bulk", icon: Layers },
  { name: "Saved", href: "/saved", icon: Bookmark },
  { name: "Move", href: "/move", icon: Truck },
  { name: "Fleet", href: "/fleet", icon: Clock },
  { name: "Finance", href: "/finance", icon: Wallet },
  { name: "Parts", href: "/parts", icon: Wrench },
  { name: "Intel", href: "/insights", icon: TrendingUp },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Right-edge fade — a discoverability hint that the tab bar scrolls horizontally. */}
      <div
        className="md:hidden fixed right-0 z-[51] pointer-events-none"
        style={{
          bottom: "env(safe-area-inset-bottom)",
          height: "56px",
          width: "28px",
          background: "linear-gradient(to right, transparent, var(--s0))",
        }}
        aria-hidden="true"
      />
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center overflow-x-auto scrollbar-hide"
        style={{
          background: "var(--s0)",
          borderTop: "1px solid var(--b1)",
          boxShadow: "0 -4px 20px rgba(60,30,60,.07)",
          height: "calc(56px + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/scan" && pathname === "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center justify-center shrink-0 gap-1 transition-all"
              style={{
                color: isActive ? "var(--amber)" : "var(--t4)",
                minWidth: 64,
                height: "100%",
                flex: "0 0 auto",
              }}
            >
              <item.icon
                style={{
                  width: 22,
                  height: 22,
                  strokeWidth: isActive ? 2.5 : 1.75,
                  transition: "all 150ms ease",
                  transform: isActive ? "translateY(-1px)" : "none",
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: isActive ? 700 : 600,
                  letterSpacing: "0.02em",
                  transition: "all 150ms ease",
                }}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
