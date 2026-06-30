"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  List,
  Map as MapIcon,
  BarChart3,
  Bookmark,
  Search,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AccountMenu } from "@/components/home/AccountMenu";

// The HomeIQ top bar — the housing twin of the cars TopNav. Persistent nav across every housing surface
// (was hand-rolled per page), teal-themed, with a scroll shadow, active pills, theme toggle, and the
// account/switch/logout menu inline on the right.
const PRIMARY = [
  { name: "Home", href: "/homeiq", icon: Home },
  { name: "Leads", href: "/homeiq/leads", icon: List },
  { name: "Markets", href: "/homeiq/states", icon: MapIcon },
  { name: "Market data", href: "/homeiq/market", icon: BarChart3 },
  { name: "Pipeline", href: "/homeiq/saved", icon: Bookmark },
];

export function HousingTopNav() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      {/* Logo */}
      <Link href="/homeiq" className="flex items-center gap-2.5 group shrink-0">
        <div
          className="w-8 h-8 rounded-xl grid place-items-center text-black font-black transition-transform group-hover:scale-105 shadow-[var(--shadow2)]"
          style={{ background: "var(--grad-home)" }}
        >
          H
        </div>
        <span className="text-[15px] font-bold tracking-tight text-[var(--t1)] hidden sm:block">
          HomeIQ
        </span>
      </Link>

      {/* Primary nav (desktop) */}
      <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
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
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => router.push("/homeiq/leads")}
          title="Search leads"
          className="h-9 w-9 grid place-items-center rounded-xl text-[var(--t3)] hover:text-[var(--t1)] bg-[var(--s0)] shadow-[var(--shadow2)] md:hidden"
        >
          <Search style={{ width: 17, height: 17 }} />
        </button>
        <ThemeToggle />
        <AccountMenu floating={false} />
      </div>
    </header>
  );
}
