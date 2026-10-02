const { test, expect } = require('@playwright/test');
const { MOCK, bookmarklet, trackDialogs, stubPrint, learnAll } = require('./helpers');

const ANSWERS = { 'Text to append': 'Test append', 'option to select': 'You (test)' };

async function runAuto(context, page, dialogs) {
  dialogs.length = 0;
  await page.locator('[data-c="5909876543210"]').click();
  const popupP = page.waitForEvent('popup');
  await page.evaluate(bookmarklet('auto'));
  return popupP;
}

test('learning, then Auto runs the whole process to Apply', async ({ browser }) => {
  const context = await browser.newContext();
  const dialogs = [];
  trackDialogs(context, dialogs, ANSWERS);
  await stubPrint(context);

  const learn = await context.newPage();
  await learnAll(learn, context);
  const cfg = await learn.evaluate(() => JSON.parse(localStorage.getItem('autoCfg')));
  expect(Object.keys(cfg.steps)).toHaveLength(12);
  expect(cfg.steps.gen.text).toBe('Generate');
  expect(cfg.steps.print.text).toBe('Print');
  expect(cfg.opts).toEqual({ extraLine: 'Test append', userOption: 'You (test)', confirmSave: true });
  await learn.close();

  const page = await context.newPage();
  await page.goto(MOCK);
  const popup = await runAuto(context, page, dialogs);

  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(page.locator('[id="log"]')).toContainText('Print: opening new tab');
  await expect(page.locator('[id="log"]')).toContainText('line3: "Test append"; user: u3');
  expect(await popup.evaluate(() => window.__printed)).toBe(1);
  expect(dialogs.map(d => d.message)).toEqual(['Save?']);
});

test('skipped optional step: form without a user list', async ({ browser }) => {
  const context = await browser.newContext();
  const dialogs = [];
  trackDialogs(context, dialogs, { 'Text to append': 'No-list append' });
  await stubPrint(context);

  const learn = await context.newPage();
  await learnAll(learn, context, { variant: 'nolist', skipUser: true });
  const cfg = await learn.evaluate(() => JSON.parse(localStorage.getItem('autoCfg')));
  expect(cfg.steps.user).toEqual({ skipped: true });
  expect(cfg.opts.userOption).toBe('');
  // no question about the option when the list is skipped
  expect(dialogs.some(d => d.message.includes('option to select'))).toBe(false);
  await learn.close();

  const page = await context.newPage();
  await page.goto(MOCK + '?variant=nolist');
  const popup = await runAuto(context, page, dialogs);
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(page.locator('[id="log"]')).toContainText('line3: "No-list append"; user: -');
});
