"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Cmd/Ctrl + K (command palette) is handled by the mounted CommandPalette
      // component, so we don't intercept it here.

      // Navigation shortcuts
      switch (e.key.toLowerCase()) {
        case "g":
          // g + h = home (find)
          if (e.shiftKey) {
            router.push("/find");
          }
          break;
        case "s":
          // s = scan
          if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
            router.push("/scan");
          }
          break;
        case "f":
          // f = fleet
          if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
            router.push("/fleet");
          }
          break;
        case "w":
          // w = watchlist (saved)
          if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
            router.push("/saved");
          }
          break;
        case "/":
          // / = focus search
          e.preventDefault();
          const searchInput = document.querySelector(
            'input[type="search"], input[placeholder*="Search"]',
          ) as HTMLInputElement;
          searchInput?.focus();
          break;
        case "?":
          // ? = log the available keyboard shortcuts
          e.preventDefault();
          console.log("Keyboard Shortcuts:", {
            "g + Shift": "Go to Find",
            s: "Go to Scan",
            f: "Go to Fleet",
            w: "Go to Saved",
            "/": "Focus Search",
            "⌘/Ctrl + K": "Command Palette",
          });
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [router]);
}
