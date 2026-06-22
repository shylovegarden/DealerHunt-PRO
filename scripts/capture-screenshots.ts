import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/login");
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: "/Users/shy/.gemini/antigravity/brain/90c87960-6ce1-47a6-8991-d218d2ed6547/login.png",
  });

  await page.fill('input[type="email"]', "stlecurepair@gmail.com");
  await page.fill('input[type="password"]', "testshy!");
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.toString().includes("login"), {
    timeout: 15000,
  });
  await page.waitForTimeout(3000); // Wait for animations and data loading
  await page.screenshot({
    path: "/Users/shy/.gemini/antigravity/brain/90c87960-6ce1-47a6-8991-d218d2ed6547/dashboard.png",
  });

  await browser.close();
}

main().catch(console.error);
