import { Toaster } from "sonner";

// Shared HomeIQ chrome. Lightweight for now — mounts the toast host so every housing surface can fire
// save/alert/export feedback (mirrors the cars dashboard). Pages keep their own headers.
export default function HomeIQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
