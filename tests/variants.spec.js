const { test, expect } = require('@playwright/test');
const { MOCK, newSession, learnAll, autoRun, waitDialog, bookmarklet, id } = require('./helpers');

const ANSWERS = { 'Text to append': 'Variant append', 'option to select': 'You (test)' };

test('form inside an iframe: Learn stores the frame path and Auto works through it', async ({ browser }) => {
  const s = await newSession(browser, ANSWERS);
  const learn = await s.context.newPage();
  await learnAll(learn, s.context, { variant: 'iframe' });
  const cfg = await learn.evaluate(() => JSON.parse(localStorage.getItem('autoCfg')));
  for (const k of ['line1', 'line2', 'line3', 'user', 'save']) {
    expect(cfg.steps[k].frame).toHaveLength(1); // inside the iframe
    expect(cfg.steps[k].frame[0]).toContain('frm');
  }
  for (const k of ['search', 'searchBtn', 'result', 'gen', 'print']) expect(cfg.steps[k].frame).toEqual([]); // in the page
  expect(cfg.rules[0].a.frame).toHaveLength(1); // the default rules know the frame, too
  await learn.close();

  const page = await s.context.newPage();
  await page.goto(MOCK + '?variant=iframe');
  const popup = await autoRun(page);
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(page.locator('[id="log"]')).toContainText('line3: "Variant append"; user: u3');
  expect(await popup.evaluate(() => window.__printed)).toBe(1);
});

test('Validate can pick fields inside an iframe', async ({ browser }) => {
  const s = await newSession(browser, {});
  const page = await s.context.newPage();
  await page.goto(MOCK + '?variant=iframe');
  await page.locator('[data-c="5901234123457"]').click();
  await page.locator(id('pt1:r1:0:cb1')).click();
  await page.locator('a.xResult').click();
  const form = page.frameLocator(id('pt1:r2:0:frm'));
  await form.locator(id('pt1:r2:0:it1::content')).waitFor();
  await page.evaluate(bookmarklet('validate'));
  await page.waitForTimeout(500);
  const bar = page.locator('[id="__validate"]');
  await bar.getByRole('button', { name: 'Add rule' }).click();
  await bar.getByRole('button', { name: 'A is not empty', exact: true }).click();
  await form.locator(id('pt1:r2:0:it3::content')).click({ modifiers: ['Control'] });
  await bar.getByRole('button', { name: 'manual only', exact: true }).click();

  await page.evaluate(bookmarklet('check'));
  expect(await waitDialog(s.dialogs, 'Failed')).toContain('"Line 3 (append)" is empty');
  await form.locator(id('pt1:r2:0:it3::content')).fill('something');
  s.dialogs.length = 0;
  await page.evaluate(bookmarklet('check'));
  expect(await waitDialog(s.dialogs, 'All')).toBe('All 1 rule(s) passed.');
});

test('full page reload between steps: Auto continues where it stopped each time it is clicked', async ({ browser }) => {
  const s = await newSession(browser, ANSWERS);
  const learn = await s.context.newPage();
  await learnAll(learn, s.context, { variant: 'reload' });
  expect(await learn.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('autoCfg')).steps).length)).toBe(18);
  await learn.close();

  const page = await s.context.newPage();
  await page.goto(MOCK + '?variant=reload');
  const popup = await autoRun(page, { reload: true });
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(page.locator('[id="log"]')).toContainText('Print: opening new tab');
  expect(await popup.evaluate(() => window.__printed)).toBe(1);
  expect(s.dialogs.filter(d => d.message === 'Save?')).toHaveLength(1); // asked once, not on every click
});

test('Auto clicked on a page it does not recognise says what is missing', async ({ browser }) => {
  const s = await newSession(browser, ANSWERS);
  const learn = await s.context.newPage();
  await learnAll(learn, s.context);
  await learn.close();
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('auto')); // nothing scanned yet
  const msg = await waitDialog(s.dialogs, 'Auto stopped');
  expect(msg).toContain('at "search"');
  expect(msg).toContain('Scan a code into the search field first.');
});
