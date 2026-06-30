import { Toaster } from "sonner";
import { HousingTopNav } from "@/components/home/HousingTopNav";
import { HousingBottomNav } from "@/components/home/HousingBottomNav";

// Shared HomeIQ chrome — now a real app shell (matching the cars dashboard): a persistent top nav + mobile
// bottom nav, an ambient teal-aurora background, and the toast host. Pages no longer hand-roll headers.
export default function HomeIQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-[var(--t1)]">
      {/* Ambient background — faint teal aurora + the base surface, fixed so it doesn't scroll. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(80% 60% at 15% -5%, color-mix(in srgb, var(--home) 12%, transparent) 0%, transparent 60%)," +
            "radial-gradient(70% 55% at 100% 0%, color-mix(in srgb, var(--home) 8%, transparent) 0%, transparent 55%)," +
            "var(--s1)",
        }}
      />
      <HousingTopNav />
      <main className="pb-20 md:pb-6">{children}</main>
      <HousingBottomNav />
      <Toaster
        position="bottom-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "var(--s0)",
            border: "1px solid var(--b2)",
            color: "var(--t1)",
          },
        }}
      />
    </div>
  );
}
