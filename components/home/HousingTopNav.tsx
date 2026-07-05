"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  List,
  Map as MapIcon,
  BarChart3,
  Bookmark,
  Columns3,
  Search,
  Bell,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AccountMenu } from "@/components/home/AccountMenu";
import { VerticalSwitch } from "@/components/shared/VerticalSwitch";

// The HomeIQ top bar — the housing twin of the cars TopNav. Persistent nav across every housing surface
// (was hand-rolled per page), teal-themed, with a scroll shadow, active pills, theme toggle, and the
// account/switch/logout menu inline on the right.
const PRIMARY = [
  { name: "Home", href: "/homeiq", icon: Home },
  { name: "Leads", href: "/homeiq/leads", icon: List },
  { name: "States", href: "/homeiq/states", icon: MapIcon },
  { name: "Market", href: "/homeiq/market", icon: BarChart3 },
  { name: "Compare", href: "/homeiq/compare", icon: Columns3 },
  { name: "Pipeline", href: "/homeiq/saved", icon: Bookmark },
];

export function HousingTopNav() {
  const pathname = usePathname() || "";
  const [scrolled, setScrolled] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Live unread-alert badge on the bell (parity with the cars nav) — refreshes every 2 min.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/homeiq/alerts", { cache: "no-store" });
        const data = await res.json();
        const unread = Array.isArray(data?.matches)
          ? data.matches.filter(
              (m: { status?: string }) => m.status === "unread",
            ).length
          : 0;
        if (!cancelled) setAlertCount(unread);
      } catch {
        /* non-fatal */
      }
    };
    load();
    const t = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Open the ⌘K palette by synthesizing the shortcut the palette already listens for — keeps the palette
  // the single owner of its open state (no shared context needed).
  const openPalette = () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/homeiq/leads" && pathname.startsWith("/homeiq/leads"));

  const pill = (active: boolean): React.CSSProperties =>
    active
      ? { background: "var(--grad-home)", color: "#04201d" }
      : { color: "var(--t4)" };

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 md:px-6"
      style={{
        background: scrolled ? "var(--s0)" : "transparent",
        borderBottom: scrolled
          ? "1px solid var(--b1)"
          : "1px solid transparent",
        boxShadow: scrolled ? "var(--shadow2)" : "none",
        transition: "all 200ms ease",
      }}
    >
      {/* Logo + vertical switch */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <Link href="/homeiq" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-xl grid place-items-center text-black font-black transition-transform group-hover:scale-105 shadow-[var(--shadow2)]"
            style={{ background: "var(--grad-home)" }}
          >
            H
          </div>
          <span className="text-[15px] font-bold tracking-tight text-[var(--t1)] hidden lg:block">
            HomeIQ
          </span>
        </Link>
        <VerticalSwitch />
      </div>

      {/* Primary nav (desktop) — in the flow (not absolute) so it centers between the two flex-1 sides and
          can never overlap them as the window narrows. */}
      <nav className="hidden md:flex items-center gap-0.5 shrink-0">
        {PRIMARY.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all"
              style={pill(active)}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "var(--s2)";
                  e.currentTarget.style.color = "var(--t1)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--t4)";
                }
              }}
            >
              <item.icon
                className="h-3.5 w-3.5"
                strokeWidth={active ? 2.5 : 2}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
        {/* Desktop ⌘K launcher — opens the command palette (search a city/ZIP or jump anywhere). */}
        <button
          onClick={openPalette}
          title="Search & jump (⌘K)"
          className="hidden md:flex items-center gap-2 h-9 pl-3 pr-2 rounded-xl text-[var(--t4)] hover:text-[var(--t2)] bg-[var(--s0)] border border-[var(--b1)] shadow-[var(--shadow2)] transition-colors"
        >
          <Search style={{ width: 15, height: 15 }} />
          <span className="text-[12px] font-semibold">Search</span>
          <kbd className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--s2)] border border-[var(--b1)] text-[var(--t4)]">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={openPalette}
          title="Search & jump (⌘K)"
          className="h-9 w-9 grid place-items-center rounded-xl text-[var(--t3)] hover:text-[var(--t1)] bg-[var(--s0)] shadow-[var(--shadow2)] md:hidden"
        >
          <Search style={{ width: 17, height: 17 }} />
        </button>
        <Link
          href="/homeiq/alerts"
          title="Alerts"
          aria-label="Alerts"
          className="relative h-9 w-9 grid place-items-center rounded-xl text-[var(--t3)] hover:text-[var(--t1)] bg-[var(--s0)] shadow-[var(--shadow2)]"
        >
          <Bell style={{ width: 17, height: 17 }} />
          {alertCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 grid place-items-center rounded-full text-[10px] font-black text-black"
              style={{ background: "var(--home)" }}
            >
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </Link>
        <Link
          href="/homeiq/settings"
          title="Settings"
          aria-label="Settings"
          className="h-9 w-9 grid place-items-center rounded-xl text-[var(--t3)] hover:text-[var(--t1)] bg-[var(--s0)] shadow-[var(--shadow2)]"
        >
          <Settings style={{ width: 17, height: 17 }} />
        </Link>
        <ThemeToggle />
        <AccountMenu floating={false} />
      </div>
    </header>
  );
}
