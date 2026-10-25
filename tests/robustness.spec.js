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

test('a malformed recording is refused before its first step is done', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.locator('[data-c="5909876543210"]').click();
  const search = { frame: [], sel: '[id="pt1:r1:0:cb1"]', alt: '', label: 'Search' };
  for (const [second, why] of [
    [{ t: 'click', win: 0, text: 'Search' }, 'Step 2: the element is missing'],
    [{ t: 'set', win: 0, src: 'eval', loc: search }, 'Step 2: unknown source "eval"'],
    [{ t: 'row', win: 0, box: search, match: 'li', mode: 'anyone' }, 'Step 2: unknown choice "anyone"'],
  ]) {
    s.dialogs.length = 0;
    await page.evaluate(m => localStorage.setItem('autoCfg', JSON.stringify({ v: 4, macro: m, opts: {}, rules: [] })),
      [{ t: 'click', win: 0, loc: search, text: 'Search' }, second]);
    await page.evaluate(bookmarklet('play'));
    expect(await waitDialog(s.dialogs, 'The recording cannot be played')).toContain(why);
  }
  await page.waitForTimeout(500);
  expect(await page.locator('[id="log"]').textContent()).not.toContain('Search:'); // step 1 was never clicked
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
