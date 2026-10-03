const { test, expect } = require('@playwright/test');
const { MOCK, bookmarklet, newSession, id } = require('./helpers');

const SEARCH = id('pt1:r1:0:it1::content');
const cfgOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('autoCfg')));

// Records a short process by hand: scan, search, pick the product row, type a fixed text.
async function recordShort(page) {
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('record'));
  await page.locator(SEARCH).fill('5901234123457');
  await page.locator(id('pt1:r1:0:cb1')).click();
  await page.locator('a.xResult').click();
  await page.locator(id('pt1:r2:0:it3::content')).fill('Fixed note');
  await page.locator(id('pt1:r2:0:it3::content')).blur();
  return page.locator('[id="__record"]');
}

test('Record never stores password fields', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(() => {
    const p = document.createElement('input');
    p.type = 'password'; p.id = 'pw';
    document.body.appendChild(p);
  });
  await page.evaluate(bookmarklet('record'));
  await page.locator('[id="pw"]').fill('hunter2-secret');
  await page.locator('[id="pw"]').blur();
  const bar = page.locator('[id="__record"]');
  await expect(bar).toContainText('password field was not recorded');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('hunter2');
  await expect(bar).toContainText('0 step(s)');
});

test('the saved recording keeps no product name, and the raw recording is cleared', async ({ browser }) => {
  const s = await newSession(browser, { 'Numbers of steps to REMOVE': '' });
  const page = await s.context.newPage();
  const bar = await recordShort(page);
  await bar.getByRole('button', { name: 'Stop and review' }).click();
  await bar.getByText('Done!').waitFor();
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain('Vacuum R10'); // the product name from the result row
  expect(stored).toContain('Fixed note'); // a fixed text typed by the user stays: it is part of the recording
  const cfg = await cfgOf(page);
  expect(cfg.macro.find(a => a.t === 'row')).toMatchObject({ mode: 'only', text: '' });
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('autoRec'))).actions).toEqual([]);
});

test('Export lists the fixed texts that leave the computer and can be cancelled', async ({ browser }) => {
  const s = await newSession(browser, { 'The exported code will contain': false });
  const page = await s.context.newPage();
  const bar = await recordShort(page);
  await bar.getByRole('button', { name: 'Stop and review' }).click();
  await bar.getByText('Done!').waitFor();
  await page.evaluate(() => { navigator.clipboard.writeText = async t => { window.__clip = t; }; });
  s.dialogs.length = 0;
  await page.evaluate(bookmarklet('export'));
  await expect.poll(() => s.dialogs.some(d => d.message.startsWith('The exported code will contain'))).toBe(true);
  const ask = s.dialogs.find(d => d.message.startsWith('The exported code will contain')).message;
  expect(ask).toContain('"Fixed note"');
  expect(ask).not.toContain('Vacuum R10');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__clip || '')).toBe(''); // cancelled: nothing was copied
});

test('Validate shows page-derived labels as text, never as HTML', async ({ browser }) => {
  const s = await newSession(browser, {});
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(() => {
    window.__pwned = 0;
    const el = document.getElementById('pt1:r1:0:it1::content');
    el.setAttribute('aria-label', '<img src=x onerror="window.__pwned=1">');
  });
  await page.evaluate(bookmarklet('validate'));
  const bar = page.locator('[id="__validate"]');
  await bar.getByRole('button', { name: 'Add rule' }).click();
  await bar.getByRole('button', { name: 'A is not empty', exact: true }).click();
  await page.locator(SEARCH).click({ modifiers: ['Control'] });
  await bar.getByRole('button', { name: 'manual only', exact: true }).click();
  await expect(bar).toContainText('Added: "<img src=x onerror="window.__pwned=1">'.slice(0, 20));
  expect(await bar.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBe(0);
});
