const { test, expect } = require('@playwright/test');
const { MOCK, bookmarklet, newSession, learnAll, autoRun, waitDialog } = require('./helpers');

const ANSWERS = { 'Text to append': 'List append', 'option to select': 'Doe Jane' };
const setProfiles = (page, list) => page.evaluate(l => localStorage.setItem('autoProfiles', JSON.stringify(l)), list);

// Learns on a mock variant with searchable lists and returns the session and the learned configuration.
async function learnedWith(browser, variant, answers = ANSWERS) {
  const s = await newSession(browser, answers);
  const page = await s.context.newPage();
  await learnAll(page, s.context, { variant, skipUser: true });
  const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('autoCfg')));
  await page.close();
  s.dialogs.length = 0;
  return { ...s, cfg };
}

test('Learn teaches a searchable person list: opener, search field and a result row', async ({ browser }) => {
  const { cfg } = await learnedWith(browser, 'combo');
  expect(cfg.steps.user).toEqual({ skipped: true });
  for (const k of ['personOpen', 'personSearch', 'personOption']) expect(cfg.steps[k].skipped).toBeUndefined();
  expect(cfg.steps.personOpen.tag).toBe('button');
  expect(cfg.steps.personSearch.tag).toBe('input');
  expect(cfg.steps.personOption.match).toBe('li.opt'); // matches every result row
  for (const k of ['orgOpen', 'orgSearch', 'orgOption']) expect(cfg.steps[k]).toEqual({ skipped: true });
  expect(cfg.opts.profiles).toEqual([{ name: 'Doe Jane', org: '' }]);
});

test('Auto opens the list, searches, waits for the late results and clicks the one matching row', async ({ browser }) => {
  const { context, dialogs } = await learnedWith(browser, 'combo');
  const page = await context.newPage();
  await page.goto(MOCK + '?variant=combo');
  const popup = await autoRun(page);
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(page.locator('[id="log"]')).toContainText('Chose in user list: Doe Jane – Org A');
  await expect(page.locator('[id="log"]')).toContainText('user: u1');
  expect(dialogs.some(d => d.type === 'prompt')).toBe(false); // the profile came from the configuration
});

test('a person with two organizations is never guessed: Auto stops and lists the rows', async ({ browser }) => {
  const { context, dialogs } = await learnedWith(browser, 'combo');
  const page = await context.newPage();
  await page.goto(MOCK + '?variant=combo');
  await setProfiles(page, [{ name: 'Roe John', org: '' }]);
  await page.locator('[data-c="5909876543210"]').click();
  await page.evaluate(bookmarklet('auto'));
  const msg = await waitDialog(dialogs, 'Auto stopped');
  expect(msg).toContain('at "person list"');
  expect(msg).toContain('More than one row');
  expect(msg).toContain('Roe John – Org A');
  expect(msg).toContain('Roe John – Org B');
  expect(msg).toContain('Nothing was selected');
  const log = await page.locator('[id="log"]').textContent();
  expect(log).not.toContain('Chose in');
  expect(log).not.toContain('Saved document');
});

test('the organization in the profile picks the right row of the same person', async ({ browser }) => {
  const { context } = await learnedWith(browser, 'combo');
  const page = await context.newPage();
  await page.goto(MOCK + '?variant=combo');
  await setProfiles(page, [{ name: 'Roe John', org: 'Org B' }]);
  const popup = await autoRun(page);
  await expect(page.locator('[id="log"]')).toContainText('Chose in user list: Roe John – Org B');
  await expect(page.locator('[id="log"]')).toContainText('user: u4');
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
});

test('a person who is not in the list is reported, nothing is saved', async ({ browser }) => {
  const { context, dialogs } = await learnedWith(browser, 'combo');
  const page = await context.newPage();
  await page.goto(MOCK + '?variant=combo');
  await setProfiles(page, [{ name: 'Nobody Here', org: '' }]);
  await page.locator('[data-c="5909876543210"]').click();
  await page.evaluate(bookmarklet('auto'));
  const msg = await waitDialog(dialogs, 'Auto stopped', 40000);
  expect(msg).toContain('No row containing "Nobody Here"');
  expect(await page.locator('[id="log"]').textContent()).not.toContain('Saved document');
});

test('a separate organization list: both lists are filled from the profile', async ({ browser }) => {
  const { context, cfg } = await learnedWith(browser, 'combo,orgcombo');
  for (const k of ['orgOpen', 'orgSearch', 'orgOption']) expect(cfg.steps[k].skipped).toBeUndefined();
  const page = await context.newPage();
  await page.goto(MOCK + '?variant=combo,orgcombo');
  await setProfiles(page, [{ name: 'Roe John', org: 'Org B' }]);
  const popup = await autoRun(page);
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  await expect(page.locator('[id="log"]')).toContainText('user: u4; org: o2');
});

test('several profiles: Auto asks which one and remembers the answer', async ({ browser }) => {
  const { context, dialogs } = await learnedWith(browser, 'combo,orgcombo');
  const page = await context.newPage();
  await page.goto(MOCK + '?variant=combo,orgcombo');
  await setProfiles(page, [{ name: 'Doe Jane', org: 'Org A' }, { name: 'Doe Jane', org: 'Org C' }]);
  dialogs.length = 0;
  context.removeAllListeners('page');
  page.removeAllListeners('dialog');
  page.on('dialog', d => { dialogs.push({ type: d.type(), message: d.message() }); d.accept(d.type() === 'prompt' ? '2' : undefined); });
  const popup = await autoRun(page);
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
  const ask = dialogs.find(d => d.message.startsWith('Which profile?'));
  expect(ask.message).toContain('1. Doe Jane / Org A');
  expect(ask.message).toContain('2. Doe Jane / Org C');
  await expect(page.locator('[id="log"]')).toContainText('user: u1; org: o3');
  expect(await page.evaluate(() => localStorage.getItem('autoProfileIdx'))).toBe('1');
});

test('Show edits the profiles of this computer', async ({ browser }) => {
  const { context } = await learnedWith(browser, 'combo');
  const page = await context.newPage();
  await page.goto(MOCK);
  const queue = ['New Person; Org B', '1', ''];
  const seen = [];
  page.removeAllListeners('dialog'); // this test answers the dialogs itself
  page.on('dialog', d => {
    seen.push(d.message());
    d.accept(d.type() === 'prompt' ? queue.shift() : undefined);
  });
  await page.evaluate(bookmarklet('show'));
  await expect.poll(() => seen.filter(m => m.startsWith('Profiles now')).length).toBe(1);
  expect(seen[0]).toContain('Profiles (from the configuration):\n1. Doe Jane');
  expect(seen.find(m => m.startsWith('Profiles:\n1. Doe Jane'))).toContain('Add: type');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('autoProfiles')))).toEqual([{ name: 'New Person', org: 'Org B' }]);
});
