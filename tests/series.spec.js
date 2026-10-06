const { test, expect } = require('@playwright/test');
const { MOCK, bookmarklet, newSession, waitDialog, id } = require('./helpers');

const SEARCH = id('pt1:r1:0:it1::content');

// A recording made by hand on the mock: scan, search, product, copy line, append, user, Save, Generate, Print, Apply.
async function record(page) {
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('record'));
  await page.locator(SEARCH).fill('5901234123457');
  await page.locator(id('pt1:r1:0:cb1')).click();
  await page.locator('a.xResult').click();
  const l1 = await page.locator(id('pt1:r2:0:it1::content')).inputValue();
  await page.locator(id('pt1:r2:0:it2::content')).fill(l1);
  await page.locator(id('pt1:r2:0:it2::content')).blur();
  await page.locator(id('pt1:r2:0:it3::content')).fill('Series append');
  await page.locator(id('pt1:r2:0:it3::content')).blur();
  await page.locator(id('pt1:r2:0:soc1::content')).selectOption({ label: 'You (test)' });
  await page.locator(id('pt1:r2:0:cb_save')).click();
  const gen = page.locator(id('pt1:r3:0:cb_gen'));
  await gen.click();
  await page.waitForFunction(() => document.getElementById('pt1:r3:0:cb_gen').textContent.trim() === 'Print');
  const popupP = page.waitForEvent('popup');
  await gen.click();
  const popup = await popupP;
  await popup.waitForLoadState();
  await popup.evaluate(bookmarklet('record'));
  await popup.locator(id('pt1:p1:cb_apply')).click();
  await popup.locator('[id="__record"]').getByRole('button', { name: 'Stop and review' }).click();
  await popup.locator('[id="__record"]').getByText('Done!').waitFor();
  await popup.close();
}

const logOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('autoLog') || '[]'));

test('Dry run reports what it finds on the current screen and changes nothing', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await record(page);
  const run = await s.context.newPage();
  await run.goto(MOCK);
  await run.locator(SEARCH).fill('5909876543210');
  s.dialogs.length = 0;
  await run.evaluate(bookmarklet('dryrun'));
  const msg = await waitDialog(s.dialogs, 'Dry run', 30000);
  expect(msg).toContain('1. type the scanned code into "Product code": OK');
  expect(msg).toContain('2. click "Search": OK');
  expect(msg).toContain('list not on this screen'); // the results appear only after a real Search
  expect(msg).toContain('click "Save": not on this screen');
  expect(msg).toContain('click "Apply" [new tab]: in the new tab, not checked');
  const log = await run.locator('[id="log"]').textContent();
  expect(log).not.toContain('Search: '); // nothing was clicked
  expect(await logOf(run)).toEqual([]); // a dry run is not a run
});

test('Dry run on the form screen checks the form steps, including the field to copy from', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await record(page);
  const run = await s.context.newPage();
  await run.goto(MOCK);
  await run.locator('[data-c="5909876543210"]').click();
  await run.locator(id('pt1:r1:0:cb1')).click();
  await run.locator('a.xResult').click();
  await run.locator(id('pt1:r2:0:it2::content')).waitFor();
  s.dialogs.length = 0;
  await run.evaluate(bookmarklet('dryrun'));
  const msg = await waitDialog(s.dialogs, 'Dry run', 30000);
  expect(msg).toMatch(/type a copy of "Line 1 \(to copy\)" into "Line 2 \(paste line 1\)": OK/);
  expect(msg).toContain('in "User": OK');
  expect(msg).toContain('click "Save": OK');
  expect(await run.locator(id('pt1:r2:0:it2::content')).inputValue()).toBe(''); // nothing typed
});

test('Series runs product after product, the same code twice counts twice, Stop ends it; the log records runs', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await record(page);
  const run = await s.context.newPage();
  await run.goto(MOCK);
  const tabs = [];
  run.on('popup', p => tabs.push(p));
  s.dialogs.length = 0;
  await run.evaluate(bookmarklet('series'));
  const bar = run.locator('[id="__series"]');
  await expect(bar).toContainText('0 done. Scan the next code.');

  for (const [n, code] of ['5909876543210', '5909876543210', '5900000000017'].entries()) {
    if (n) await run.locator(id('pt1:r3:0:cb_new')).click(); // back to the search screen, as a person would
    await run.locator(SEARCH).fill(code); // the scanner types the code
    await expect.poll(() => tabs.length, { timeout: 40000 }).toBe(n + 1);
    await expect(tabs[n].locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
    await expect(bar).toContainText((n + 1) + ' done.', { timeout: 10000 });
  }
  await bar.getByRole('button', { name: 'Stop' }).click();
  expect(await waitDialog(s.dialogs, 'Series finished')).toBe('Series finished: 3 product(s).');
  expect(s.dialogs.filter(d => d.message === 'Save?')).toHaveLength(3);
  const text = await run.locator('[id="log"]').textContent();
  expect(text.match(/Saved document/g)).toHaveLength(3);

  const L = await logOf(run);
  expect(L.map(x => x.result + ':' + x.mode)).toEqual(['ok:series', 'ok:series', 'ok:series']);
  expect(JSON.stringify(L)).not.toMatch(/590|Lidar|Battery|You \(test\)/); // no codes, products or people
});

test('a stopped run is logged with its step; Show summarises the log and keeps it unless told otherwise', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await record(page);
  const run = await s.context.newPage();
  await run.goto(MOCK + '?variant=saveerror');
  await run.locator(SEARCH).fill('5909876543210');
  await run.evaluate(bookmarklet('play'));
  await waitDialog(s.dialogs, 'Play stopped');
  const L = await logOf(run);
  expect(L).toHaveLength(1);
  expect(L[0]).toMatchObject({ result: 'stopped', mode: 'once', why: 'The application reported an error after Save' });
  expect(L[0].step).toMatch(/^step 8 \(click "Generate"\)$/);

  s.dialogs.length = 0;
  await run.evaluate(bookmarklet('show'));
  const msg = await waitDialog(s.dialogs, 'Run log');
  expect(msg).toContain('Today: 1 runs, 0 completed');
  expect(msg).toContain('1x step 8 (click "Generate"): The application reported an error after Save');
  await waitDialog(s.dialogs, 'Keep the run log?');
  expect(await logOf(run)).toHaveLength(1); // OK = keep
});

test('Series needs a scan step in the recording', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(() => localStorage.setItem('autoCfg', JSON.stringify({ v: 4, macro: [{ t: 'click', win: 0, loc: { frame: [], sel: 'body', alt: '', label: 'x' }, text: '' }], opts: {}, rules: [] })));
  await page.evaluate(bookmarklet('series'));
  expect(await waitDialog(s.dialogs, 'The recording has no scan step')).toContain('Series');
});
