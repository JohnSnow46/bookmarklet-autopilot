const { test, expect } = require('@playwright/test');
const { MOCK, bookmarklet, newSession, waitDialog } = require('./helpers');

/* ---------- damaged or unknown configurations ---------- */

for (const bm of ['play', 'series', 'auto', 'show', 'export', 'validate', 'check']) {
  test('a damaged saved configuration is reported by ' + bm + ', nothing runs', async ({ browser }) => {
    const s = await newSession(browser);
    const page = await s.context.newPage();
    await page.goto(MOCK);
    await page.evaluate(() => localStorage.setItem('autoCfg', '{damaged'));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluate(bookmarklet(bm));
    expect(await waitDialog(s.dialogs, 'The saved configuration cannot be read')).toContain('Record (or Learn) again');
    expect(errors).toEqual([]);
  });
}

test('a configuration from a newer version is not run', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(() => localStorage.setItem('autoCfg', JSON.stringify({ v: 9, macro: [] })));
  await page.evaluate(bookmarklet('play'));
  await waitDialog(s.dialogs, 'The configuration was made by a newer version');
});

test('Record and Learn start over when their saved state is damaged', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(() => { localStorage.setItem('autoCfg', '{damaged'); localStorage.setItem('autoRec', '{damaged'); localStorage.setItem('autoLearn', '[1'); });
  await page.evaluate(bookmarklet('record'));
  await expect(page.locator('[id="__record"]')).toContainText('0 step(s)');
  await page.evaluate(bookmarklet('learn'));
  await expect(page.locator('[id="__learn"]')).toContainText('Learn 1/');
});

test('a damaged run log does not hide why Play stopped', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(() => {
    localStorage.setItem('autoLog', '{damaged');
    localStorage.setItem('autoCfg', JSON.stringify({ v: 4, macro: [{ t: 'set', win: 0, src: 'scan', loc: { frame: [], sel: '[id="pt1:r1:0:it1::content"]', alt: '', label: 'Product code' } }], opts: {}, rules: [] }));
  });
  await page.evaluate(bookmarklet('play'));
  expect(await waitDialog(s.dialogs, 'Play stopped')).toContain('Scan a code into');
  const L = await page.evaluate(() => JSON.parse(localStorage.getItem('autoLog')));
  expect(L).toHaveLength(1);
});
