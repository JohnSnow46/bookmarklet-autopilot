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

/* ---------- finding elements ---------- */

// A recording whose scan field is found by an id that no longer exists, so only the fallback name="q" is left.
const SCAN_BY_NAME = { t: 'set', win: 0, src: 'scan', loc: { frame: [], sel: '[id="old-id"]', alt: 'input[name="q"]', label: 'Product code' } };
const nameTheSearchField = (page, twins) => page.evaluate(n => {
  const el = document.getElementById('pt1:r1:0:it1::content');
  el.setAttribute('name', 'q');
  for (let i = 0; i < n; i++) { const t = document.createElement('input'); t.name = 'q'; t.className = 'twin'; el.after(t); }
}, twins);

test('a fallback selector is used only while it matches exactly one element', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(m => localStorage.setItem('autoCfg', JSON.stringify({ v: 4, macro: m, opts: {}, rules: [] })), [SCAN_BY_NAME]);
  await nameTheSearchField(page, 0);
  await page.evaluate(bookmarklet('dryrun'));
  expect(await waitDialog(s.dialogs, 'Dry run')).toContain('1. type the scanned code into "Product code": OK');

  await nameTheSearchField(page, 1); // now two fields are called q: neither may be guessed
  s.dialogs.length = 0;
  await page.evaluate(bookmarklet('dryrun'));
  expect(await waitDialog(s.dialogs, 'Dry run')).not.toContain('"Product code": OK');
});

const SEARCH_BTN = { frame: [], sel: '[id="pt1:r1:0:cb1"]', alt: '', label: 'Search' };
const SCAN = { t: 'set', win: 0, src: 'scan', loc: { frame: [], sel: '[id="pt1:r1:0:it1::content"]', alt: '', label: 'Product code' } };
// Saves a recording with a short wait, so that a step that cannot go on gives up after 2 seconds.
const saveMacro = (page, macro, opts = {}) => page.evaluate(([m, o]) => localStorage.setItem('autoCfg',
  JSON.stringify({ v: 4, macro: m, opts: { waitSec: 2, confirmSave: true, ...o }, rules: [] })), [macro, opts]);

test('when Play gives up waiting it says why the element cannot be used', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  const cases = [
    [[SCAN, { t: 'click', win: 0, loc: SEARCH_BTN, text: 'Search' }], p => p.evaluate(() => { document.getElementById('pt1:r1:0:cb1').disabled = true; }),
      'Cannot use "Search": found, but disabled (waited 2 s)'],
    [[SCAN, { t: 'click', win: 0, loc: SEARCH_BTN, text: 'Find' }], null, 'Cannot use "Find": found, but its caption is "Search" instead of "Find"'],
    [[SCAN, { t: 'click', win: 0, loc: SEARCH_BTN, text: 'Search' }], p => p.evaluate(() => { document.getElementById('pt1:r1:0:cb1').style.display = 'none'; }),
      'Cannot use "Search": found, but hidden'],
    [[SCAN_BY_NAME], p => nameTheSearchField(p, 1), 'its fallback selector matches 2 elements'],
    [[SCAN, { t: 'click', win: 0, loc: { ...SEARCH_BTN, sel: '[id="gone"]' }, text: 'Search' }], null, 'Cannot use "Search": not on this screen'],
  ];
  for (const [macro, prep, msg] of cases) {
    await page.goto(MOCK);
    await saveMacro(page, macro);
    await page.locator('[data-c="5909876543210"]').click();
    if (prep) await prep(page);
    s.dialogs.length = 0;
    await page.evaluate(bookmarklet('play'));
    expect(await waitDialog(s.dialogs, 'Play stopped', 10000)).toContain(msg);
  }
});

/* ---------- progress and cancelling ---------- */

for (const how of ['the Cancel button', 'Esc']) {
  test('Play shows its progress and can be cancelled with ' + how + ' while it waits', async ({ browser }) => {
    const s = await newSession(browser);
    const page = await s.context.newPage();
    await page.goto(MOCK);
    await saveMacro(page, [SCAN, { t: 'click', win: 0, loc: SEARCH_BTN, text: 'Search' }], { waitSec: 60 });
    await page.locator('[data-c="5909876543210"]').click();
    await page.evaluate(() => { document.getElementById('pt1:r1:0:cb1').disabled = true; }); // Play has to wait
    await page.evaluate(bookmarklet('play'));
    const bar = page.locator('[id="__play"]');
    await expect(bar).toContainText('step 2/2: click "Search"');
    if (how === 'Esc') await page.keyboard.press('Escape');
    else await bar.getByRole('button', { name: 'Cancel (Esc)' }).click();
    await expect(bar).toContainText('Cancelled at step 2');
    await expect(bar).toHaveCount(0, { timeout: 5000 }); // the bar cleans up after itself
    await page.evaluate(() => { document.getElementById('pt1:r1:0:cb1').disabled = false; });
    await page.waitForTimeout(500);
    expect(await page.locator('[id="log"]').textContent()).not.toContain('Search:'); // never clicked
    expect(s.dialogs).toEqual([]); // a cancel is not an error
    const L = await page.evaluate(() => JSON.parse(localStorage.getItem('autoLog')));
    expect(L.map(x => x.result + ':' + x.why)).toEqual(['cancelled:Cancelled by the user.']);
  });
}

test('Stop in Series also stops a run that is under way', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await saveMacro(page, [SCAN, { t: 'click', win: 0, loc: SEARCH_BTN, text: 'Search' }], { waitSec: 60 });
  await page.evaluate(() => { document.getElementById('pt1:r1:0:cb1').disabled = true; });
  await page.evaluate(bookmarklet('series'));
  await page.locator('[id="pt1:r1:0:it1::content"]').fill('5909876543210');
  const bar = page.locator('[id="__series"]');
  await expect(bar).toContainText('Working on product 1: step 2/2.');
  await bar.getByRole('button', { name: 'Stop' }).click();
  expect(await waitDialog(s.dialogs, 'Series finished')).toBe('Series finished: 0 product(s).');
  const L = await page.evaluate(() => JSON.parse(localStorage.getItem('autoLog')));
  expect(L.map(x => x.result + ':' + x.mode)).toEqual(['cancelled:series']);
});

test('Play says when it is done and removes its bar', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await saveMacro(page, [SCAN, { t: 'click', win: 0, loc: SEARCH_BTN, text: 'Search' }]);
  await page.locator('[data-c="5909876543210"]').click();
  await page.evaluate(bookmarklet('play'));
  const bar = page.locator('[id="__play"]');
  await expect(bar).toContainText('Done, 2 steps.');
  await expect(bar).toHaveCount(0, { timeout: 5000 });
  expect(s.dialogs).toEqual([]);
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
