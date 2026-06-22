import fs from "fs";

let content = fs.readFileSync("scripts/e2e-test.ts", "utf-8");

const newTests = `
// ─── 15. LIST ────────────────────────────────────────────────────────────────
async function testList(page: Page) {
  currentSection = 'List';
  console.log('\n📋 SECTION: List');

  await tryStep('List page responds 200', async () => {
    await goto(page, '/list');
    const url = page.url();
    if (!url.includes('/list')) throw new Error('Redirected away to: ' + url);
  });

  await tryStep('List page renders platforms or content', async () => {
    const text = await page.textContent('body');
    if (!text || !/facebook|autotrader|cargurus|craigslist|cross-post/i.test(text)) throw new Error('No list content found');
  });
}

// ─── 16. MOVE ────────────────────────────────────────────────────────────────
async function testMove(page: Page) {
  currentSection = 'Move';
  console.log('\n📋 SECTION: Move (Transport)');

  await tryStep('Move page responds 200', async () => {
    await goto(page, '/move');
  });

  await tryStep('Move page has transport info', async () => {
    const text = await page.textContent('body');
    if (!text || !/transport|carrier|dispatch|logistics/i.test(text)) throw new Error('No move content found');
  });
}

// ─── 17. RECON ───────────────────────────────────────────────────────────────
async function testRecon(page: Page) {
  currentSection = 'Recon';
  console.log('\n📋 SECTION: Recon');

  await tryStep('Recon page responds 200', async () => {
    await goto(page, '/recon');
  });

  await tryStep('Recon page has content', async () => {
    const text = await page.textContent('body');
    if (!text || !/recon|repair|service|vendor|inspection/i.test(text)) throw new Error('No recon content found');
  });
}

// ─── 18. SAVED ───────────────────────────────────────────────────────────────
async function testSaved(page: Page) {
  currentSection = 'Saved';
  console.log('\n📋 SECTION: Saved');

  await tryStep('Saved page responds 200', async () => {
    await goto(page, '/saved');
  });

  await tryStep('Saved page has content', async () => {
    const text = await page.textContent('body');
    if (!text || !/saved|watchlist|empty|cars/i.test(text)) throw new Error('No saved content found');
  });
}

// ─── 19. SEARCHES ────────────────────────────────────────────────────────────
async function testSearches(page: Page) {
  currentSection = 'Searches';
  console.log('\n📋 SECTION: Searches');

  await tryStep('Searches page responds 200', async () => {
    await goto(page, '/searches');
  });

  await tryStep('Searches page has content', async () => {
    const text = await page.textContent('body');
    if (!text || !/search|query|filter|empty|saved searches/i.test(text)) throw new Error('No searches content found');
  });
}
`;

content = content.replace("// ─── MAIN ───", newTests + "\n// ─── MAIN ───");

const calls = `
    await testList(page);
    await testMove(page);
    await testRecon(page);
    await testSaved(page);
    await testSearches(page);
`;

content = content.replace(
  "await testFind(page);",
  "await testFind(page);\n" + calls,
);

fs.writeFileSync("scripts/e2e-test.ts", content);
