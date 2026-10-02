const { test, expect } = require('@playwright/test');
const { MOCK, bookmarklet, trackDialogs, stubPrint, learnAll } = require('./helpers');

test('nauka, a potem Auto przechodzi cały proces do Apply', async ({ browser }) => {
  const context = await browser.newContext();
  const dialogs = [];
  trackDialogs(context, dialogs);
  await stubPrint(context);

  const learn = await context.newPage();
  await learnAll(learn, context);
  const cfg = await learn.evaluate(() => JSON.parse(localStorage.getItem('autoCfg')));
  expect(Object.keys(cfg)).toHaveLength(11);
  expect(cfg.gen.text).toBe('Generuj');
  expect(cfg.print.text).toBe('Print');
  await learn.close();

  dialogs.length = 0;
  const page = await context.newPage();
  await page.goto(MOCK);
  await page.locator('[data-c="5909876543210"]').click();
  const popupP = page.waitForEvent('popup');
  await page.evaluate(bookmarklet('auto'));
  const popup = await popupP;

  await expect(popup.locator('[id="log"]')).toContainText('Apply → drukowanie', { timeout: 30000 });
  await expect(page.locator('[id="log"]')).toContainText('Print: otwieram nową kartę');
  await expect(page.locator('[id="log"]')).toContainText('Zapisano dokument');
  expect(await popup.evaluate(() => window.__printed)).toBe(1);
  expect(dialogs.map(d => d.message)).toEqual(['Zapisać?']);
});
