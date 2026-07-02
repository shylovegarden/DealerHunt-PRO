"use client";

// Segment error boundary for the HomeIQ (housing) app. Keeps the nav/shell intact and lets the user
// recover in place; reports to Sentry. Teal-accented to match HomeIQ.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function HomeIQError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-6 text-center space-y-4">
        <div className="text-3xl">⚠️</div>
        <div>
          <h2 className="text-lg font-bold text-[var(--t1)]">
            This view hit a snag
          </h2>
          <p className="text-sm text-[var(--t3)] mt-1">
            It’s been logged. The rest of the app is fine — try again.
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="text-sm font-bold rounded-xl px-5 py-2.5 text-black border-none min-h-[44px]"
          style={{ background: "var(--grad-home)" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
