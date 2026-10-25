// Seed for the Playwright test agents (.claude/agents/playwright-test-*): a fresh page on the demo app.
const { test, expect } = require('@playwright/test');
const { MOCK } = require('./helpers');

test('seed: the demo app opens on the product search', async ({ page }) => {
  await page.goto(MOCK);
  await expect(page.locator('[id="pt1:r1:0:it1::content"]')).toBeVisible();
});
