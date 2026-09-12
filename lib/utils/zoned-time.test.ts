import { describe, it, expect } from "vitest";
import { parseUsDateTimeInZone, MUNICIBID_TZ } from "./zoned-time";

describe("parseUsDateTimeInZone", () => {
  it("reads a summer time as EDT (UTC-4), not as the runner's local zone", () => {
    expect(parseUsDateTimeInZone("7/9/2026 10:00:00 AM", MUNICIBID_TZ)).toBe(
      "2026-07-09T14:00:00.000Z",
    );
  });

  it("reads a winter time as EST (UTC-5) — the offset is not hard-coded", () => {
    expect(parseUsDateTimeInZone("1/9/2026 10:00:00 AM", MUNICIBID_TZ)).toBe(
      "2026-01-09T15:00:00.000Z",
    );
  });

  it("handles the 12 AM / 12 PM boundaries", () => {
    expect(parseUsDateTimeInZone("1/9/2026 12:00:00 AM", MUNICIBID_TZ)).toBe(
      "2026-01-09T05:00:00.000Z",
    );
    expect(parseUsDateTimeInZone("7/9/2026 12:00:00 PM", MUNICIBID_TZ)).toBe(
      "2026-07-09T16:00:00.000Z",
    );
  });

  it("accepts the seconds-less form the detail pages use", () => {
    expect(parseUsDateTimeInZone("9/22/2026 9:36 AM", MUNICIBID_TZ)).toBe(
      "2026-09-22T13:36:00.000Z",
    );
  });

  it("round-trips — the instant it returns displays as the original wall time in Eastern", () => {
    const show = (iso: string): string =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: MUNICIBID_TZ,
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
        .format(new Date(iso))
        .replace(",", "")
        // Intl uses a narrow no-break space before AM/PM in newer ICU builds.
        .replace(/\u202f/g, " ");

    for (const raw of [
      "7/9/2026 10:00:00 AM", // EDT
      "1/9/2026 10:00:00 AM", // EST
      "3/8/2026 3:30:00 AM", // the morning clocks spring forward
      "11/1/2026 3:30:00 AM", // the morning clocks fall back
    ]) {
      expect(show(parseUsDateTimeInZone(raw, MUNICIBID_TZ)!)).toBe(raw);
    }
  });

  it("returns undefined rather than inventing a date", () => {
    expect(parseUsDateTimeInZone(undefined, MUNICIBID_TZ)).toBeUndefined();
    expect(parseUsDateTimeInZone("", MUNICIBID_TZ)).toBeUndefined();
    expect(parseUsDateTimeInZone("Ends soon", MUNICIBID_TZ)).toBeUndefined();
    expect(parseUsDateTimeInZone("13/45/2026 10:00:00 AM", MUNICIBID_TZ)).toBeUndefined();
    expect(parseUsDateTimeInZone("7/9/2026 13:00:00 AM", MUNICIBID_TZ)).toBeUndefined();
  });
});
