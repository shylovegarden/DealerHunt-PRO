// lib/utils/zoned-time.ts
//
// Auction sites render start/end times as bare wall-clock strings ("7/9/2026 10:00:00 AM") and state
// the timezone only in the surrounding page chrome. `new Date(raw)` resolves those against the
// *runtime's* local zone, so the same listing becomes a different instant on a dev laptop, a UTC CI
// runner, and a production server. Parse the wall-clock fields explicitly and convert from the
// timezone the site actually publishes in.

/** Offset, in ms, between a UTC instant and the wall-clock time `timeZone` shows for it. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const at = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    at("hour"),
    at("minute"),
    at("second"),
  );
  return asIfUtc - utcMs;
}

// Wall-clock fields → UTC epoch. Sampled twice so the offset is measured at the resulting instant
// rather than the naive one, which is what keeps the hour either side of a DST change correct.
function wallTimeToUtcMs(wallAsUtcMs: number, timeZone: string): number {
  const firstPass = wallAsUtcMs - zoneOffsetMs(wallAsUtcMs, timeZone);
  return wallAsUtcMs - zoneOffsetMs(firstPass, timeZone);
}

const US_DATETIME =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp])\.?[Mm]\.?$/;

/**
 * Parse "M/D/YYYY h:mm[:ss] AM/PM" as wall-clock time in `timeZone`, returning an ISO-8601 UTC
 * string. Returns undefined for absent or malformed input so callers record the field as unknown
 * instead of inventing a date.
 */
export function parseUsDateTimeInZone(
  raw: string | undefined,
  timeZone: string,
): string | undefined {
  const m = raw?.trim().match(US_DATETIME);
  if (!m) return undefined;

  const [, mo, d, y, h, mi, s, meridiem] = m;
  const month = Number(mo);
  const day = Number(d);
  const hour12 = Number(h);
  const minute = Number(mi);
  // Date.UTC silently rolls over out-of-range fields ("13/45/2026" would become a real date), so
  // reject them rather than storing a plausible-looking wrong timestamp.
  if (month < 1 || month > 12) return undefined;
  if (day < 1 || day > 31) return undefined;
  if (hour12 < 1 || hour12 > 12) return undefined;
  if (minute > 59) return undefined;

  const hour = (hour12 % 12) + (meridiem.toLowerCase() === "p" ? 12 : 0);
  const wall = Date.UTC(
    Number(y),
    month - 1,
    day,
    hour,
    minute,
    Number(s ?? 0),
  );
  const utc = wallTimeToUtcMs(wall, timeZone);
  return Number.isNaN(utc) ? undefined : new Date(utc).toISOString();
}

/**
 * Municibid publishes every auction start/end in Eastern Time — its listing pages print the labelled
 * form ("Tuesday, September 22, 2026 9:36 AM ET") directly beside the bare numeric form the browse
 * cards carry. Change this one constant if that ever stops being true.
 */
export const MUNICIBID_TZ = "America/New_York";
