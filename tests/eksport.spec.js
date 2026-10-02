const { test, expect } = require('@playwright/test');
const { MOCK, bookmarklet, newSession, learnAll, autoRun, waitDialog } = require('./helpers');

const ANSWERS = { 'Text to append': 'Exported append', 'option to select': 'You (test)' };

// Captures what Export copies to the clipboard.
const captureClipboard = page => page.evaluate(() => { navigator.clipboard.writeText = async t => { window.__clip = t; }; });

test('Show summarises the configuration', async ({ browser }) => {
  const s = await newSession(browser, ANSWERS);
  const page = await s.context.newPage();
  await learnAll(page, s.context, { variant: 'nolist', skipUser: true });
  s.dialogs.length = 0;
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('show'));
  const msg = await waitDialog(s.dialogs, 'Steps:');
  expect(msg).toContain('search: input');
  expect(msg).toContain('save: button "Save"');
  expect(msg).toContain('user: (skipped)');
  expect(msg).toContain('error: (skipped)');
  expect(msg).toContain('Append text: "Exported append"');
  expect(msg).toContain('Ask "Save?": yes');
  expect(msg).toContain('"line1" equals "line2" [before Save]');
});

test('Show without a configuration says so', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('show'));
  expect(await waitDialog(s.dialogs, 'Nothing learned yet')).toContain('Learn');
});

test('Export gives a one-line Auto with the configuration built in, usable on another computer', async ({ browser }) => {
  // computer 1: learn, then export without the personal list option
  const one = await newSession(browser, { ...ANSWERS, 'Include your list option': false });
  const learn = await one.context.newPage();
  await learnAll(learn, one.context);
  await learn.goto(MOCK);
  await captureClipboard(learn);
  await learn.evaluate(bookmarklet('export'));
  await expect.poll(() => learn.evaluate(() => window.__clip || '')).not.toBe('');
  const code = await learn.evaluate(() => window.__clip);
  expect(code.startsWith('javascript:')).toBe(true);
  expect(code).not.toMatch(/[#%\r\n]/);
  expect(code).not.toContain('Exported append'); // the configuration is base64, not readable text
  const embedded = JSON.parse(Buffer.from(/const EMBED="([^"]+)"/.exec(code)[1], 'base64').toString('utf8'));
  expect(embedded.opts.userOption).toBe(''); // personal choice left out
  expect(embedded.opts.extraLine).toBe('Exported append');
  expect(embedded.rules).toHaveLength(3);
  const exported = code.slice('javascript:'.length);

  // computer 2: a fresh browser profile, nothing learned there, the list option is asked on the first run
  const two = await newSession(browser, { 'option to select': 'You (test)' });
  const page = await two.context.newPage();
  await page.goto(MOCK);
  expect(await page.evaluate(() => localStorage.getItem('autoCfg'))).toBeNull();
  let popup = null;
  page.on('popup', p => { popup = p; });
  await page.locator('[data-c="5909876543210"]').click();
  await page.evaluate(exported);
  await expect.poll(() => popup, { timeout: 40000 }).not.toBeNull();
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(page.locator('[id="log"]')).toContainText('line3: "Exported append"; user: u3');
  expect(two.dialogs.some(d => d.type === 'prompt' && d.message.includes('option to select'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('autoUserOption'))).toBe('You (test)');
});

test('Export can include the list option, and falls back to a prompt without a clipboard', async ({ browser }) => {
  const s = await newSession(browser, ANSWERS); // the confirm "Include your list option" is accepted
  const page = await s.context.newPage();
  await learnAll(page, s.context);
  await page.goto(MOCK);
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); });
  s.dialogs.length = 0;
  await page.evaluate(bookmarklet('export'));
  const shown = await waitDialog(s.dialogs, 'Copy this code');
  expect(s.dialogs.some(d => d.message.startsWith('Include your list option "You (test)"'))).toBe(true);
  expect(shown).toContain('Copy this code');
});

test('Export without a configuration says so', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('export'));
  expect(await waitDialog(s.dialogs, 'Nothing learned yet')).toContain('Learn');
});
