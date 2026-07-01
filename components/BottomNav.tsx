"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Search,
  SlidersHorizontal,
  FileCheck,
  Clock,
} from "lucide-react";

// Core 5 tabs — identical to the desktop TopNav primary so nav is consistent across mobile/desktop.
// Everything else lives in the "More" menu / Settings.
const NAV_ITEMS = [
  { name: "Discover", href: "/discover", icon: Compass },
  { name: "Scan", href: "/scan", icon: Search },
  { name: "Market", href: "/market", icon: SlidersHorizontal },
  { name: "Deal Check", href: "/deal-check", icon: FileCheck },
  { name: "Fleet", href: "/fleet", icon: Clock },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: "var(--s0)",
        borderTop: "1px solid var(--b1)",
        boxShadow: "0 -4px 20px rgba(60,30,60,.07)",
        height: "calc(56px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href === "/discover" && pathname === "/");
        return (
          <Link
            key={item.name}
            href={item.href}
            className="flex flex-1 flex-col items-center justify-center gap-1 transition-all"
            style={{ color: isActive ? "var(--amber)" : "var(--t4)" }}
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
