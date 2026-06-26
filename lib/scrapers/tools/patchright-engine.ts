import { chromium, Browser, Page } from "patchright";

export interface ScraperOptions {
  headless?: boolean;
  proxy?: string;
  userAgent?: string;
}

/**
 * Uses Patchright (stealth Chromium) to bypass Cloudflare and anti-bot systems.
 * This drops in perfectly where Playwright would be used, but doesn't leak fingerprints.
 */
export async function createPatchrightBrowser(
  options: ScraperOptions = {},
): Promise<{ browser: Browser; page: Page }> {
  console.log("[Patchright] Launching stealth Chromium browser...");

  const browserArgs = [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
  ];

  const browser = await chromium.launch({
    headless: options.headless !== false, // default true
    args: browserArgs,
    proxy: options.proxy ? { server: options.proxy } : undefined,
  });

  const context = await browser.newContext({
    userAgent:
      options.userAgent ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    hasTouch: false,
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  const page = await context.newPage();

  // Route interception to speed up scraping (block images, fonts, media)
  await page.route("**/*", (route) => {
    const request = route.request();
    if (
      ["image", "media", "font", "stylesheet"].includes(request.resourceType())
    ) {
      route.abort();
    } else {
      route.continue();
    }
  });

  return { browser, page };
}

/**
 * Run a sequence of fetches through ONE stealth browser (launch once, reuse the page). Far cheaper
 * than fetchWithPatchright per page when paginating a source. The callback gets a `goto(url)` that
 * navigates and returns the rendered HTML after letting any Cloudflare/PerimeterX JS challenge clear.
 * Set tough=true (headed + real Chrome channel) for PerimeterX/Akamai sources that detect headless.
 */
export async function withPatchrightSession<T>(
  fn: (goto: (url: string) => Promise<string>) => Promise<T>,
  options: ScraperOptions & { tough?: boolean; settleMs?: number } = {},
): Promise<T> {
  const { browser, page } = await createPatchrightBrowser(options);
  const settle = options.settleMs ?? 3500;
  try {
    const goto = async (url: string): Promise<string> => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(settle); // let the anti-bot JS challenge auto-resolve before snapshot
      return page.content();
    };
    return await fn(goto);
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function fetchWithPatchright(
  url: string,
  waitForSelector?: string,
  proxy?: string,
): Promise<string> {
  const { browser, page } = await createPatchrightBrowser(
    proxy ? { proxy } : {},
  );

  try {
    console.log(
      `[Patchright] Navigating to ${url}${proxy ? " (via proxy)" : ""}`,
    );

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    if (waitForSelector) {
      console.log(`[Patchright] Waiting for selector: ${waitForSelector}`);
      await page.waitForSelector(waitForSelector, { timeout: 15000 });
    } else {
      await page.waitForTimeout(3000);
    }

    const content = await page.content();
    console.log(`[Patchright] Fetched ${content.length} bytes.`);

    return content;
  } catch (error) {
    console.error(`[Patchright] Error fetching ${url}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}
