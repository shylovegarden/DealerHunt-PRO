// lib/scrapers/smart-fetch.ts
//
// One fetch to rule them all — an autonomous, self-learning escalation ladder. Every scraper calls
// smartFetch(url) and gets back rendered HTML from the CHEAPEST tool that actually beats the site's
// defenses, climbing only as far as it must:
//
//   static  → plain HTTP (undici). Free, instant. Works for open sites + JSON-ish HTML.
//   stealth → Patchright stealth Chromium, HEADLESS. Beats Cloudflare (cars.com). CI-friendly.
//   headed  → Patchright + real Chrome, HEADED + persistent context. The only free path past
//             PerimeterX / Akamai (truecar, autotrader, cargurus). Needs a display — present on
//             macOS, and on Linux CI only under `xvfb-run` (or DISPLAY / ENABLE_HEADED_SCRAPERS set).
//
// It REMEMBERS which tier won per host, so after the first page every later page jumps straight to the
// working tool instead of re-probing the cheap ones. Browser tiers keep ONE warm browser per host for
// the whole run (sequential pagination reuses it; different hosts get isolated pages so the concurrent
// orchestrator is race-safe). Call closeSmartFetch() once the run is done.
//
// This is the single brain behind the walls. Sources just say "fetch this URL"; the system picks the
// tool. See open-api-source-unlocks memory for the per-site wall map.

import { chromium } from "patchright";
import type { BrowserContext, Page } from "patchright";

export type FetchTier = "static" | "stealth" | "headed";

export interface SmartFetchResult {
  html: string;
  tier: FetchTier;
  blocked: boolean;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// The full ladder, cheap → powerful. Each fetch climbs from where it expects to win.
const LADDER: FetchTier[] = ["static", "stealth", "headed"];

// Headed Chrome needs a real display. macOS always has one; Linux CI only under xvfb (which exports
// DISPLAY) or when explicitly opted in. Off → the headed tier is skipped and those hosts return
// blocked (gracefully) instead of crashing a headless box.
const HEADED_AVAILABLE =
  process.platform === "darwin" ||
  !!process.env.DISPLAY ||
  process.env.ENABLE_HEADED_SCRAPERS === "1";

// Per-host learned winner. "none" = no available tier beat this host this run → short-circuit.
const hostWinner = new Map<string, FetchTier | "none">();

// One warm browser/page per host, per browser tier (isolation = concurrency safety). Keyed
// "tier:host". Persistent contexts (Patchright's strongest stealth mode) — closed in closeSmartFetch.
const browserByKey = new Map<string, { ctx: BrowserContext; page: Page }>();

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Challenge / block-page detection. Anti-bot interstitials are tiny and carry tell-tale markers.
const BLOCK_RE =
  /just a moment|attention required|cf-chl|_cf_chl|px-captcha|perimeterx|pardon our interruption|page unavailable|access to this page has been denied|enable javascript and cookies|verify you are (a )?human|unusual traffic/i;

function isBlocked(html: string, status: number): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  if (html.length < 800) return true; // stubs / redirects / empty challenges
  return BLOCK_RE.test(html.slice(0, 12000));
}

// ── Tier: static HTTP ──────────────────────────────────────────────────────
async function fetchStatic(
  url: string,
): Promise<{ html: string; status: number }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Upgrade-Insecure-Requests": "1",
    },
    signal: AbortSignal.timeout(20_000),
  });
  return { html: await res.text(), status: res.status };
}

// ── Browser tiers (Patchright persistent context = strongest stealth) ──────
// stealth = headless Chromium (beats Cloudflare). headed = visible real Chrome (beats PerimeterX/
// Akamai, needs a display). NB: deliberately NO page.route() — request interception enables the CDP
// Fetch domain, which Patchright can't hide and Cloudflare detects.
async function browserPageFor(
  host: string,
  tier: "stealth" | "headed",
): Promise<Page> {
  const key = `${tier}:${host}`;
  const existing = browserByKey.get(key);
  if (existing && !existing.page.isClosed()) return existing.page;
  const ctx = await chromium.launchPersistentContext("", {
    headless: tier === "stealth",
    channel: tier === "headed" ? "chrome" : undefined,
    viewport: { width: 1400, height: 900 },
    // Override the UA on headless so it doesn't advertise "HeadlessChrome"; headed real Chrome is fine.
    userAgent: tier === "stealth" ? UA : undefined,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      ...(tier === "headed"
        ? ["--start-maximized"]
        : ["--disable-setuid-sandbox", "--disable-dev-shm-usage"]),
    ],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  browserByKey.set(key, { ctx, page });
  return page;
}

async function fetchViaBrowser(
  url: string,
  host: string,
  tier: "stealth" | "headed",
): Promise<string> {
  const page = await browserPageFor(host, tier);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40_000 });
  // Poll until the anti-bot JS challenge actually clears, rather than guessing a fixed sleep — a short
  // settle would snapshot the "Just a moment" page and wrongly escalate. Cap the wait so a truly
  // unbeatable wall still gives up. A quick first settle covers fast-rendering SPAs.
  await page.waitForTimeout(2500);
  let html = await page.content();
  const deadline = Date.now() + (tier === "headed" ? 13_000 : 9000);
  while (isBlocked(html, 200) && Date.now() < deadline) {
    await page.waitForTimeout(1500);
    html = await page.content();
  }
  return html;
}

export interface SmartFetchOptions {
  // Optional content check. A tier's HTML must be (a) not a block page AND (b) pass validate() to count
  // as solved. Lets the ladder climb past a non-blocked-but-empty SPA shell (static 200 with no data)
  // to the tier that actually renders the listings. Without it, "not blocked" alone counts as success.
  validate?: (html: string) => boolean;
}

/**
 * Fetch a URL through the cheapest tool that beats the host's defenses, learning + reusing per host.
 * Never throws on a wall — returns { blocked: true, html: "" } so callers degrade gracefully.
 */
export async function smartFetch(
  url: string,
  opts: SmartFetchOptions = {},
): Promise<SmartFetchResult> {
  const host = hostOf(url);

  const learned = hostWinner.get(host);
  if (learned === "none") return { html: "", tier: "static", blocked: true };

  // Try the learned winner first, then climb the rest of the ladder as a fallback.
  const order: FetchTier[] = learned
    ? [learned, ...LADDER.filter((t) => t !== learned)]
    : [...LADDER];

  let lastTier: FetchTier = "static";
  let sawBlock = false;
  // A tier that wasn't blocked but didn't validate — likely a genuinely empty page (e.g. last page of
  // pagination). Kept so we can return it cleanly instead of falsely flagging the host as walled.
  let cleanEmpty: { html: string; tier: FetchTier } | null = null;

  for (const tier of order) {
    if (tier === "headed" && !HEADED_AVAILABLE) continue;
    lastTier = tier;
    try {
      let html: string;
      let status = 200;
      if (tier === "static") {
        const r = await fetchStatic(url);
        html = r.html;
        status = r.status;
      } else {
        html = await fetchViaBrowser(url, host, tier);
      }
      if (isBlocked(html, status)) {
        sawBlock = true;
        continue; // a real wall — climb
      }
      // Not blocked. Does it actually carry what the caller needs?
      if (!opts.validate || opts.validate(html)) {
        if (hostWinner.get(host) !== tier) {
          hostWinner.set(host, tier);
          console.log(`[smartFetch] ${host} → solved via "${tier}"`);
        }
        return { html, tier, blocked: false };
      }
      // The already-learned tier returning a clean-but-empty page = genuine end of data, not a wall.
      if (tier === learned) return { html, tier, blocked: false };
      if (!cleanEmpty) cleanEmpty = { html, tier };
    } catch (e) {
      console.warn(
        `[smartFetch] ${tier} errored for ${host}: ${(e as Error).message}`,
      );
    }
  }

  // A clean (non-blocked) but data-less page from some tier = legitimately empty result — return it
  // without poisoning host memory.
  if (cleanEmpty)
    return { html: cleanEmpty.html, tier: cleanEmpty.tier, blocked: false };

  // Every tier was actually blocked — remember so the rest of this run's pages short-circuit instead
  // of re-probing every tool. Resets next process (a wall may lift, or xvfb may appear).
  if (sawBlock) {
    hostWinner.set(host, "none");
    console.warn(`[smartFetch] ${host} → no tier passed (blocked)`);
  }
  return { html: "", tier: lastTier, blocked: true };
}

/** Tear down every warm browser. Call once at the end of a scrape run. */
export async function closeSmartFetch(): Promise<void> {
  for (const { ctx } of Array.from(browserByKey.values())) {
    await ctx.close().catch(() => {});
  }
  browserByKey.clear();
}

/** Introspection for the status surface — which tool each host is currently being solved by. */
export function getHostTierMap(): Record<string, FetchTier | "none"> {
  return Object.fromEntries(Array.from(hostWinner.entries()));
}
