import { Toaster } from "sonner";
import { AccountMenu } from "@/components/home/AccountMenu";

// Shared HomeIQ chrome: a subtle ambient background (so the app isn't flat charcoal), the account menu
// (vertical switcher + logout), and the toast host. Pages keep their own headers.
export default function HomeIQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Ambient background — a faint teal aurora + vignette behind everything, fixed so it doesn't scroll. */}
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
      <AccountMenu />
      {children}
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
    </>
  );
}
