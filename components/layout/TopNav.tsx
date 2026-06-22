"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map,
  Search,
  Truck,
  Clock,
  Wallet,
  Wrench,
  Settings,
  Bell,
  Bookmark,
  BarChart3,
  Activity,
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
  { name: "Alerts", href: "/searches", icon: Bell },
  { name: "Move", href: "/move", icon: Truck },
  { name: "Fleet", href: "/fleet", icon: Clock },
  { name: "Recon", href: "/recon", icon: Activity },
  { name: "Finance", href: "/finance", icon: Wallet },
  { name: "Parts", href: "/parts", icon: Wrench },
  { name: "Intel", href: "/insights", icon: TrendingUp },
];

export function TopNav() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchAlerts() {
      try {
        const res = await fetch("/api/alerts/unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setAlertCount(data.count ?? 0);
      } catch {
        // silent
      }
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 md:px-6"
      style={{
        background: scrolled ? "var(--s0)" : "var(--s1)",
        borderBottom: scrolled
          ? "1px solid var(--b1)"
          : "1px solid transparent",
        boxShadow: scrolled ? "var(--shadow2)" : "none",
        transition: "all 200ms ease",
      }}
    >
      {/* LEFT: Logo */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link href="/scan" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
            style={{ background: "var(--grad)" }}
          >
            <BarChart3 className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-[var(--t1)] hidden sm:block">
            DealerHunt<span className="text-[var(--amber)] ml-0.5">Pro</span>
          </span>
        </Link>
      </div>

      {/* CENTER: Navigation (Desktop Only) */}
      <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/scan" && pathname === "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all"
              style={
                isActive
                  ? {
                      background: "var(--grad)",
                      color: "#fff",
                    }
                  : {
                      color: "var(--t4)",
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--s2)";
                  (e.currentTarget as HTMLElement).style.color = "var(--t1)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--t4)";
                }
              }}
            >
              <item.icon
                className="h-3.5 w-3.5"
                strokeWidth={isActive ? 2.5 : 2}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Alerts bell */}
        <Link
          href="/alerts"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
          style={{
            background: "var(--s0)",
            boxShadow: "var(--shadow2)",
            color: "var(--t3)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--t1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--t3)";
          }}
          title="Alerts"
        >
          <Bell style={{ width: 17, height: 17 }} />
          {alertCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: "var(--amber)", lineHeight: 1 }}
            >
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
          style={{
            background: "var(--s0)",
            boxShadow: "var(--shadow2)",
            color: "var(--t3)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--t1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--t3)";
          }}
          title="Settings"
        >
          <Settings style={{ width: 17, height: 17 }} />
        </Link>
      </div>
    </header>
  );
}
