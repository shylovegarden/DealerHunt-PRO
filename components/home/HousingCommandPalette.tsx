"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

// ⌘K command palette for HomeIQ — the housing twin of components/shared/CommandPalette, teal-themed and
// pointed at housing routes. It doubles as a SEARCH LAUNCHER: type a city or ZIP and the top row becomes
// "Search '<query>'" → /homeiq/leads?q=…, so ⌘K is the fastest way into any market. Self-contained; mounted
// once in app/homeiq/layout.tsx.

interface Command {
  id: string;
  label: string;
  glyph: string;
  hint?: string;
  run: () => void;
  keywords?: string[];
}

export function HousingCommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();

  const go = (href: string) => {
    setOpen(false);
    setSearch("");
    router.push(href);
  };

  const navCommands: Command[] = useMemo(
    () => [
      {
        id: "home",
        label: "Home",
        glyph: "🏠",
        keywords: ["overview", "dashboard"],
        run: () => go("/homeiq"),
      },
      {
        id: "hot",
        label: "Hot leads",
        glyph: "🔥",
        hint: "tier: hot",
        keywords: ["best", "top", "motivated"],
        run: () => go("/homeiq/leads?tier=hot"),
      },
      {
        id: "leads",
        label: "All leads",
        glyph: "📋",
        keywords: ["browse", "list", "properties"],
        run: () => go("/homeiq/leads"),
      },
      {
        id: "states",
        label: "Browse all states",
        glyph: "🗺️",
        keywords: ["map", "markets", "country"],
        run: () => go("/homeiq/states"),
      },
      {
        id: "market",
        label: "Market data",
        glyph: "📊",
        keywords: ["stats", "trends", "charts", "psf"],
        run: () => go("/homeiq/market"),
      },
      {
        id: "pipeline",
        label: "Pipeline",
        glyph: "💼",
        keywords: ["saved", "kanban", "deals", "crm"],
        run: () => go("/homeiq/saved"),
      },
      {
        id: "near",
        label: "Find leads near me",
        glyph: "📍",
        keywords: ["location", "geolocation", "nearby"],
        run: () => {
          setOpen(false);
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              () => router.push("/homeiq/states"),
              () => router.push("/homeiq/states"),
              { timeout: 8000 },
            );
          } else router.push("/homeiq/states");
        },
      },
      {
        id: "cars",
        label: "Switch to DealerHunt (cars)",
        glyph: "🚗",
        keywords: ["vehicles", "autos", "dealerhunt"],
        run: () => go("/discover"),
      },
    ],
    [router],
  );

  // When the user has typed something, the first row searches the market for it (city/ZIP/keyword).
  const commands: Command[] = useMemo(() => {
    const q = search.trim();
    const query = q.toLowerCase();
    const matched = q
      ? navCommands.filter(
          (c) =>
            c.label.toLowerCase().includes(query) ||
            c.keywords?.some((k) => k.includes(query)),
        )
      : navCommands;
    if (!q) return matched;
    const searchRow: Command = {
      id: "search",
      label: `Search “${q}” in leads`,
      glyph: "🔎",
      hint: "city · ZIP · keyword",
      run: () => go(`/homeiq/leads?q=${encodeURIComponent(q)}`),
    };
    return [searchRow, ...matched];
  }, [search, navCommands]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((p) => !p);
        setSearch("");
        setSelected(0);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((p) => (p + 1) % commands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((p) => (p - 1 + commands.length) % commands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        commands[selected]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, commands]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[18vh] animate-fadeIn"
      style={{ background: "rgba(4,18,16,0.45)", backdropFilter: "blur(2px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl mx-4 glass-panel overflow-hidden animate-popIn"
        style={{ boxShadow: "var(--shadow3)", padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-[var(--b1)]">
          <span className="text-lg">🔎</span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(0);
            }}
            placeholder="Jump to… or search a city / ZIP"
            className="flex-1 bg-transparent border-none outline-none text-base text-[var(--t1)] placeholder:text-[var(--t4)]"
            autoFocus
          />
          <kbd className="px-2 py-1 text-xs bg-[var(--s2)] border border-[var(--b1)] rounded">
            ESC
          </kbd>
        </div>

        {/* Commands */}
        <div className="max-h-96 overflow-y-auto">
          {commands.length === 0 ? (
            <div className="p-8 text-center text-[var(--t4)]">No matches</div>
          ) : (
            commands.map((cmd, idx) => {
              const active = idx === selected;
              return (
                <button
                  key={cmd.id}
                  onMouseEnter={() => setSelected(idx)}
                  onClick={() => cmd.run()}
                  className="w-full flex items-center gap-3 p-3 text-left transition-colors border-l-2"
                  style={{
                    background: active ? "var(--home-lo)" : "transparent",
                    borderColor: active ? "var(--home)" : "transparent",
                  }}
                >
                  <span className="text-lg w-6 text-center">{cmd.glyph}</span>
                  <span className="flex-1 text-sm font-semibold text-[var(--t1)]">
                    {cmd.label}
                  </span>
                  {cmd.hint && (
                    <span className="text-[11px] text-[var(--t4)]">
                      {cmd.hint}
                    </span>
                  )}
                  {active && (
                    <kbd className="px-2 py-1 text-xs bg-[var(--s2)] border border-[var(--b1)] rounded">
                      ↵
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-[var(--b1)] bg-[var(--s1)] text-xs text-[var(--t4)]">
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-[var(--s2)] border border-[var(--b1)] rounded">
              ↑↓
            </kbd>
            Navigate
            <kbd className="px-1.5 py-0.5 bg-[var(--s2)] border border-[var(--b1)] rounded ml-2">
              ↵
            </kbd>
            Open
          </span>
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
