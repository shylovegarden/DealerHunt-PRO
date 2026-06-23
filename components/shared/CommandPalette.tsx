"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "./Ico";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();

  const commands: Command[] = useMemo(() => {
    const dest: {
      id: string;
      label: string;
      icon: string;
      href: string;
      keywords?: string[];
    }[] = [
      {
        id: "today",
        label: "Today",
        icon: "scan",
        href: "/today",
        keywords: ["home", "dashboard", "pulse"],
      },
      {
        id: "discover",
        label: "Discover",
        icon: "search",
        href: "/discover",
        keywords: ["deals", "feed", "flash"],
      },
      {
        id: "scan",
        label: "Scan Market",
        icon: "scan",
        href: "/scan",
        keywords: ["search", "grid", "filter"],
      },
      {
        id: "map",
        label: "Deal Map",
        icon: "map",
        href: "/map",
        keywords: ["location", "near", "geo"],
      },
      {
        id: "insights",
        label: "Intel & ROI",
        icon: "trending-up",
        href: "/insights",
        keywords: ["intelligence", "outcomes", "calibration", "roi"],
      },
      {
        id: "status",
        label: "System Status",
        icon: "bot",
        href: "/status",
        keywords: ["health", "freshness", "pipeline"],
      },
      {
        id: "saved",
        label: "Saved Vehicles",
        icon: "car",
        href: "/saved",
        keywords: ["watchlist", "bookmarks"],
      },
      {
        id: "alerts",
        label: "Alerts",
        icon: "bell",
        href: "/alerts",
        keywords: ["notifications", "matches"],
      },
      {
        id: "bulk",
        label: "Bulk Sourcing",
        icon: "fleet",
        href: "/bulk",
        keywords: ["multi", "wholesale"],
      },
      {
        id: "compare",
        label: "Compare",
        icon: "filter",
        href: "/compare",
        keywords: ["versus", "leaderboard"],
      },
      {
        id: "check",
        label: "Deal Check",
        icon: "calculator",
        href: "/deal-check",
        keywords: ["analyze", "fees"],
      },
      {
        id: "fleet",
        label: "Fleet Management",
        icon: "fleet",
        href: "/fleet",
        keywords: ["inventory"],
      },
      {
        id: "finance",
        label: "Finance Calculator",
        icon: "finance",
        href: "/finance",
        keywords: ["floor plan", "lender"],
      },
      {
        id: "parts",
        label: "Parts Teardown",
        icon: "parts",
        href: "/parts",
        keywords: ["salvage", "repair"],
      },
      {
        id: "move",
        label: "Transport Quotes",
        icon: "move",
        href: "/move",
        keywords: ["shipping", "logistics"],
      },
      {
        id: "developer",
        label: "Developer API",
        icon: "bot",
        href: "/developer",
        keywords: ["mcp", "api", "keys"],
      },
      {
        id: "settings",
        label: "Settings",
        icon: "settings",
        href: "/settings",
        keywords: ["preferences", "profile"],
      },
    ];
    return dest.map((d) => ({
      id: d.id,
      label: d.label,
      icon: d.icon,
      keywords: d.keywords,
      action: () => router.push(d.href),
    }));
  }, [router]);

  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const query = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.keywords?.some((k) => k.includes(query)),
    );
  }, [commands, search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setSearch("");
        setSelected(0);
      }

      if (!open) return;

      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(
          (prev) =>
            (prev - 1 + filteredCommands.length) % filteredCommands.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        filteredCommands[selected]?.action();
        setOpen(false);
        setSearch("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selected, filteredCommands]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] animate-fadeIn"
      style={{ background: "rgba(36,28,43,0.4)" }}
    >
      <div
        className="w-full max-w-2xl mx-4 glass-panel overflow-hidden animate-popIn"
        style={{ boxShadow: "var(--shadow3)" }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-[var(--b1)]">
          <Ico name="search" className="text-[var(--t3)]" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(0);
            }}
            placeholder="Search commands..."
            className="flex-1 bg-transparent border-none outline-none text-base text-[var(--t1)] placeholder:text-[var(--t3)]"
            autoFocus
          />
          <kbd className="px-2 py-1 text-xs bg-[var(--s2)] border border-[var(--b1)] rounded">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-[var(--t3)]">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-left transition-colors",
                  idx === selected
                    ? "border-l-2 border-[var(--amber)]"
                    : "hover:bg-[var(--s1)] border-l-2 border-transparent",
                )}
                style={
                  idx === selected
                    ? { background: "var(--amber-lo)" }
                    : undefined
                }
              >
                <Ico
                  name={cmd.icon as any}
                  size={20}
                  className="text-[var(--t2)]"
                />
                <span className="flex-1 text-sm font-medium text-[var(--t1)]">
                  {cmd.label}
                </span>
                {idx === selected && (
                  <kbd className="px-2 py-1 text-xs bg-[var(--s2)] border border-[var(--b1)] rounded">
                    ↵
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-[var(--b1)] bg-[var(--s1)] text-xs text-[var(--t3)]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--s2)] border border-[var(--b1)] rounded">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-[var(--s2)] border border-[var(--b1)] rounded">
                ↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--s2)] border border-[var(--b1)] rounded">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[var(--s2)] border border-[var(--b1)] rounded">
              ⌘K
            </kbd>
            Toggle
          </span>
        </div>
      </div>
    </div>
  );
}
