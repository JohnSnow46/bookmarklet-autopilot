const { test, expect } = require('@playwright/test');
const { MOCK, bookmarklet, newSession, autoRun, waitDialog, id } = require('./helpers');

const SEARCH = id('pt1:r1:0:it1::content');
const has = (variant, v) => variant.split(',').includes(v);
const cfgOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('autoCfg')));

// The person does the process once, normally (plain clicks and typing) while Record is running.
// The review questions are answered with their defaults unless the test gives answers.
async function recordProcess(page, { variant = '', code = '5901234123457', combo = false } = {}) {
  const iframe = has(variant, 'iframe');
  const form = iframe ? page.frameLocator(id('pt1:r2:0:frm')) : page;
  await page.goto(MOCK + (variant ? '?variant=' + variant : ''));
  await page.evaluate(bookmarklet('record'));

  await page.locator(SEARCH).fill(code); // like a scanner
  await page.locator(id('pt1:r1:0:cb1')).click();
  await page.locator('a.xResult').click();
  await form.locator(id('pt1:r2:0:it1::content')).waitFor();
  if (iframe) await page.waitForTimeout(600); // let Record hook the freshly created frame
  await form.locator(id('pt1:r2:0:it2::content')).fill(await form.locator(id('pt1:r2:0:it1::content')).inputValue());
  await form.locator(id('pt1:r2:0:it2::content')).blur(); // leaving a field commits it, as a person would by clicking on
  await form.locator(id('pt1:r2:0:it3::content')).fill('Recorded append');
  await form.locator(id('pt1:r2:0:it3::content')).blur();
  if (combo) {
    await form.locator(id('pt1:r2:0:cmb1')).click();
    await form.locator(id('pt1:r2:0:cmb1:srch')).fill('Doe');
    await form.locator(id('pt1:r2:0:cmb1:list') + ' li.opt').first().click();
  } else {
    await form.locator(id('pt1:r2:0:soc1::content')).selectOption({ label: 'You (test)' });
  }
  await form.locator(id('pt1:r2:0:cb_save')).click();
  const gen = page.locator(id('pt1:r3:0:cb_gen'));
  await gen.click();
  await page.waitForFunction(() => document.getElementById('pt1:r3:0:cb_gen').textContent.trim() === 'Print');
  const popupP = page.waitForEvent('popup');
  await gen.click();
  const popup = await popupP;
  await popup.waitForLoadState();
  await popup.evaluate(bookmarklet('record')); // continue the recording in the new tab
  await popup.locator(id('pt1:p1:cb_apply')).click();
  await popup.locator('[id="__record"]').getByRole('button', { name: 'Stop and review' }).click();
  await popup.locator('[id="__record"]').getByText('Done!').waitFor();
  await popup.close();
}

test('record the process once, then Play repeats it for the next product', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await recordProcess(page);
  const cfg = await cfgOf(page);
  expect(cfg.v).toBe(4);
  expect(cfg.macro.map(a => a.t).join()).toBe('set,click,row,set,set,select,click,click,click,click');
  const [scan, search, row, copy, append, select, save, gen, print, apply] = cfg.macro;
  expect(scan.src).toBe('scan');
  expect(scan.value).toBeUndefined(); // the scanned code is not stored
  expect(search.text).toBe('Search');
  expect(row.mode).toBe('only'); // the row contained the scanned code: it changes with every scan
  expect(copy.src).toBe('copy');
  expect(copy.from.label).toBe('Line 1 (to copy)');
  expect(append.value).toBe('Recorded append');
  expect(select.text).toBe('You (test)');
  expect([save.text, save.confirm]).toEqual(['Save', true]); // asks "Save?" by default
  expect([gen.text, print.text, apply.text]).toEqual(['Generate', 'Print', 'Apply']);
  expect(apply.win).toBe(1); // clicked in the new tab

  const run = await s.context.newPage();
  await run.goto(MOCK);
  s.dialogs.length = 0;
  const popup = await autoRun(run, { bm: 'play', scan: '5909876543210' }); // another product
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(run.locator('[id="log"]')).toContainText('Selected: Lidar module LDS-3');
  await expect(run.locator('[id="log"]')).toContainText('line3: "Recorded append"; user: u3');
  expect(await popup.evaluate(() => window.__printed)).toBe(1);
  expect(s.dialogs.map(d => d.message)).toEqual(['Save?']);
});

test('Play without a scanned code says what to do', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await recordProcess(page);
  const run = await s.context.newPage();
  await run.goto(MOCK);
  s.dialogs.length = 0;
  await run.evaluate(bookmarklet('play'));
  const msg = await waitDialog(s.dialogs, 'Play stopped');
  expect(msg).toContain('step 1 (type the scanned code');
  expect(msg).toContain('Scan a code into');
});

test('Play stops when a field does not keep the value the framework changed', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await recordProcess(page);
  const run = await s.context.newPage();
  await run.goto(MOCK + '?variant=mangle'); // upper-cases the pasted line
  await run.locator(SEARCH).fill('5901234123457');
  await run.evaluate(bookmarklet('play'));
  const msg = await waitDialog(s.dialogs, 'Play stopped');
  expect(msg).toContain('did not keep the value');
  expect(msg).toContain('PCB-R10-MAIN REV.B');
  const log = await run.locator('[id="log"]').textContent();
  expect(log).not.toContain('Saved document');
});

test('an application error after Save stops Play with the error text', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await recordProcess(page);
  const run = await s.context.newPage();
  await run.goto(MOCK + '?variant=saveerror');
  await run.locator(SEARCH).fill('5901234123457');
  await run.evaluate(bookmarklet('play'));
  const msg = await waitDialog(s.dialogs, 'Play stopped');
  expect(msg).toContain('The application reported an error after Save');
  expect(msg).toContain('ORA-00001');
  expect(await run.locator('[id="log"]').textContent()).not.toContain('Print: opening new tab');
});

test('declining "Save?" ends the run quietly, nothing is saved', async ({ browser }) => {
  const s = await newSession(browser, { '=Save?': false });
  const page = await s.context.newPage();
  await recordProcess(page);
  const run = await s.context.newPage();
  await run.goto(MOCK);
  await run.locator(SEARCH).fill('5901234123457');
  s.dialogs.length = 0;
  await run.evaluate(bookmarklet('play'));
  await waitDialog(s.dialogs, 'Save?');
  await run.waitForTimeout(1500);
  expect(s.dialogs.map(d => d.message)).toEqual(['Save?']); // no error alert
  expect(await run.locator('[id="log"]').textContent()).not.toContain('Saved document');
});

test('full page reloads: click Play again after each one and it continues', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await recordProcess(page);
  const run = await s.context.newPage();
  await run.goto(MOCK + '?variant=reload');
  s.dialogs.length = 0;
  const popup = await autoRun(run, { bm: 'play', reload: true, scan: '5909876543210' });
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  expect(s.dialogs.filter(d => d.message === 'Save?')).toHaveLength(1);
});

test('a form inside an iframe is recorded and played', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await recordProcess(page, { variant: 'iframe' });
  const cfg = await cfgOf(page);
  expect(cfg.macro.filter(a => a.loc && a.loc.frame.length).length).toBe(4); // line2, line3, list, Save
  const run = await s.context.newPage();
  await run.goto(MOCK + '?variant=iframe');
  const popup = await autoRun(run, { bm: 'play', scan: '5909876543210' });
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(run.locator('[id="log"]')).toContainText('line3: "Recorded append"');
});

test('a searchable list: your name and organization from the profile pick the row', async ({ browser }) => {
  const s = await newSession(browser, {
    'you picked the list row': m => (m.includes('Doe Jane') ? '3' : undefined), // the product row keeps its default
    'Your name as it appears': 'Doe Jane',
  });
  const page = await s.context.newPage();
  await recordProcess(page, { variant: 'combo', combo: true });
  const cfg = await cfgOf(page);
  const person = cfg.macro.find(a => a.t === 'row' && a.mode === 'profile.name');
  expect(person.match).toBe('li.opt');
  const typed = cfg.macro[cfg.macro.indexOf(person) - 1];
  expect(typed).toMatchObject({ t: 'set', src: 'profile.name' }); // the search text follows the profile
  expect(cfg.opts.profiles).toEqual([{ name: 'Doe Jane', org: '' }]);

  // the same recording works for someone else, in another organization
  const run = await s.context.newPage();
  await run.goto(MOCK + '?variant=combo');
  await run.evaluate(() => localStorage.setItem('autoProfiles', JSON.stringify([{ name: 'Roe John', org: 'Org B' }])));
  const popup = await autoRun(run, { bm: 'play', scan: '5909876543210' });
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(run.locator('[id="log"]')).toContainText('Chose in user list: Roe John – Org B');
  await expect(run.locator('[id="log"]')).toContainText('user: u4');
});

test('a person with two organizations is never guessed when the organization is missing', async ({ browser }) => {
  const s = await newSession(browser, { 'you picked the list row': m => (m.includes('Doe Jane') ? '3' : undefined), 'Your name as it appears': 'Doe Jane' });
  const page = await s.context.newPage();
  await recordProcess(page, { variant: 'combo', combo: true });
  const run = await s.context.newPage();
  await run.goto(MOCK + '?variant=combo');
  await run.evaluate(() => localStorage.setItem('autoProfiles', JSON.stringify([{ name: 'Roe John', org: '' }])));
  await run.locator(SEARCH).fill('5909876543210');
  await run.evaluate(bookmarklet('play'));
  const msg = await waitDialog(s.dialogs, 'Play stopped');
  expect(msg).toContain('More than one row matches');
  expect(msg).toContain('Roe John – Org A');
  expect(msg).toContain('Roe John – Org B');
  expect(await run.locator('[id="log"]').textContent()).not.toContain('Chose in');
});

test('Show lists the recorded steps', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await recordProcess(page);
  s.dialogs.length = 0;
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('show'));
  const msg = await waitDialog(s.dialogs, 'Recorded steps:');
  expect(msg).toContain('1. type the scanned code into');
  expect(msg).toContain('click "Search"');
  expect(msg).toContain('(the only row)');
  expect(msg).toContain('click "Save"   [asks "Save?"]');
  expect(msg).toContain('click "Apply" [new tab]');
});

test('Export hands a recording to another computer: one line, configuration built in', async ({ browser }) => {
  const one = await newSession(browser);
  const page = await one.context.newPage();
  await recordProcess(page);
  await page.goto(MOCK);
  await page.evaluate(() => { navigator.clipboard.writeText = async t => { window.__clip = t; }; });
  await page.evaluate(bookmarklet('export'));
  await expect.poll(() => page.evaluate(() => window.__clip || '')).not.toBe('');
  const code = await page.evaluate(() => window.__clip);
  expect(code.startsWith('javascript:')).toBe(true);
  expect(code).not.toMatch(/[#%\r\n]/);
  expect(code).not.toContain('Recorded append'); // base64, not readable text
  const embedded = JSON.parse(Buffer.from(/const EMBED="([^"]+)"/.exec(code)[1], 'base64').toString('utf8'));
  expect(embedded.v).toBe(4);
  expect(embedded.macro).toHaveLength(10);

  const two = await newSession(browser); // another computer: nothing recorded there
  const other = await two.context.newPage();
  await other.goto(MOCK);
  expect(await other.evaluate(() => localStorage.getItem('autoCfg'))).toBeNull();
  const popup = await autoRun(other, { scan: '5909876543210', bm: 'play' }).catch(() => null);
  expect(popup).toBeNull(); // plain Play knows nothing there...
  two.dialogs.length = 0;
  let popup2 = null;
  other.on('popup', p => { popup2 = p; });
  await other.locator(SEARCH).fill('5909876543210');
  await other.evaluate(code.slice('javascript:'.length)); // ...but the exported one has the recording built in
  await expect.poll(() => popup2, { timeout: 40000 }).not.toBeNull();
  await expect(popup2.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(other.locator('[id="log"]')).toContainText('line3: "Recorded append"');
});

test('Record can be cancelled and steps can be removed in the review', async ({ browser }) => {
  const s = await newSession(browser, { 'Numbers of steps to REMOVE': '1' });
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('record'));
  await page.locator(SEARCH).fill('5901234123457');
  await page.locator(id('pt1:r1:0:cb1')).click();
  const bar = page.locator('[id="__record"]');
  await expect(bar).toContainText('2 step(s)');
  await bar.getByRole('button', { name: 'Undo last' }).click();
  await expect(bar).toContainText('1 step(s)');
  await bar.getByRole('button', { name: 'Stop and review' }).click();
  await bar.getByText('Done!').waitFor();
  expect((await cfgOf(page)).macro).toHaveLength(0); // step 1 was removed
  await page.evaluate(bookmarklet('record'));
  await page.locator('[id="__record"]').getByRole('button', { name: 'Cancel recording' }).click();
  expect(await page.evaluate(() => localStorage.getItem('autoRec'))).toBeNull();
});
