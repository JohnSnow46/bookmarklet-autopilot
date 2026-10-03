const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { useSource, MOCK, newSession, learnAll, autoRun } = require('./helpers');

const NAMES = ['record', 'play', 'series', 'dryrun', 'learn', 'auto', 'validate', 'check', 'show', 'export'];
const dist = n => fs.readFileSync(path.join(__dirname, '..', 'dist', n + '.txt'), 'utf8');
const INSTALLER = '/docs/index.html';

test.afterAll(() => useSource(null));

test('every dist bookmarklet is one line, without hash or percent, and has no network API', () => {
  for (const n of NAMES) {
    const code = dist(n);
    expect(code.startsWith('javascript:'), n).toBe(true);
    expect(code, n).not.toMatch(/[#%\r\n]/);
    expect(code, n).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|eval)\b/);
  }
});

test('the installer shows each bookmarklet exactly as built, with its SHA-256', async ({ page }) => {
  await page.goto(INSTALLER);
  await expect(page).toHaveTitle(/installer/);
  expect(await page.locator('a.bm').count()).toBe(NAMES.length);
  for (const [i, n] of NAMES.entries()) {
    expect(await page.locator('a.bm').nth(i).getAttribute('href'), n + ' link').toBe(dist(n));
    expect(await page.locator('[id="code-' + n + '"]').textContent(), n + ' code').toBe(dist(n));
    const sha = crypto.createHash('sha256').update(dist(n)).digest('hex');
    await expect(page.locator('.hash').nth(i)).toContainText(sha);
  }
});

test('copy buttons copy the code (and the test code)', async ({ page }) => {
  await page.goto(INSTALLER);
  await page.evaluate(() => { navigator.clipboard.writeText = async t => { window.__clip = t; }; });
  await page.locator('button[data-copy="code-auto"]').click();
  expect(await page.evaluate(() => window.__clip)).toBe(dist('auto'));
  await page.locator('button[data-copy-text]').click();
  expect(await page.evaluate(() => window.__clip)).toBe("javascript:alert('ok')");
});

test('the installer links to a working mock', async ({ page }) => {
  await page.goto(INSTALLER);
  await page.locator('a', { hasText: 'test mock' }).click();
  await expect(page).toHaveURL(/docs\/mock\/mock-oracle\.html/);
  await expect(page.locator('[id="view"] h2')).toHaveText('Product search');
});

test('bookmarklets taken from the installer links learn and run the process on the mock', async ({ browser }) => {
  const s = await newSession(browser, { 'Text to append': 'Installer append', 'option to select': 'You (test)' });
  const page = await s.context.newPage();
  await page.goto(INSTALLER);
  const hrefs = {};
  for (const [i, n] of NAMES.entries()) hrefs[n] = await page.locator('a.bm').nth(i).getAttribute('href');
  useSource(n => hrefs[n]);

  await learnAll(page, s.context);
  const run = await s.context.newPage();
  await run.goto(MOCK);
  const popup = await autoRun(run);
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(run.locator('[id="log"]')).toContainText('line3: "Installer append"');
});
