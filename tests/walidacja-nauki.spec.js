const { test, expect } = require('@playwright/test');
const { MOCK, CTRL, bookmarklet, trackDialogs, stubPrint, learnAll, id } = require('./helpers');

const SEARCH_INPUT = id('pt1:r1:0:it1::content');
const SEARCH_BTN = id('pt1:r1:0:cb1');
const learnState = page => page.evaluate(() => JSON.parse(localStorage.getItem('autoLearn') || 'null'));

async function start(browser, answers) {
  const context = await browser.newContext();
  const dialogs = [];
  trackDialogs(context, dialogs, answers);
  const page = await context.newPage();
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('learn'));
  return { context, page, dialogs };
}

test('shifted step: wrong element type is flagged and can be rejected', async ({ browser }) => {
  const { page, dialogs } = await start(browser, { 'Warning for': false });
  // step 1 expects the search input, we point at the Search button instead
  await page.locator(SEARCH_BTN).click(CTRL);
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0].message).toContain('looks like a button');
  expect(dialogs[0].message).toContain('expects an input');
  expect(dialogs[0].message).toContain('Are you sure?');
  const st = await learnState(page);
  expect(st === null || st.i === 0).toBe(true); // rejected: nothing was stored
  await page.locator('[id="__learn"]').getByText('Learn 1/11').waitFor();
});

test('shifted step: the user can accept the warning anyway', async ({ browser }) => {
  const { page, dialogs } = await start(browser, {});
  await page.locator(SEARCH_BTN).click(CTRL);
  expect(dialogs[0].message).toContain('Are you sure?');
  expect((await learnState(page)).i).toBe(1);
});

test('the same element picked for two steps is flagged', async ({ browser }) => {
  const { page, dialogs } = await start(browser, { 'Warning for': false });
  await page.locator(SEARCH_INPUT).click(CTRL); // step 1: fine, no dialog
  expect(dialogs).toHaveLength(0);
  await page.locator(SEARCH_INPUT).click(CTRL); // step 2 expects a button and repeats step 1
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0].message).toContain('already picked for the "search" step');
  expect((await learnState(page)).i).toBe(1);
});

test('a selector matching several visible elements is flagged', async ({ browser }) => {
  const { page, dialogs } = await start(browser, { 'Warning for': false });
  await page.evaluate(() => {
    const el = document.getElementById('pt1:r1:0:it1::content');
    const twin = el.cloneNode(true); // same id twice, as some generated pages do
    el.parentNode.appendChild(twin);
  });
  await page.locator(SEARCH_INPUT).first().click(CTRL);
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0].message).toContain('matches 2 visible elements');
});

test('an auto-generated looking id is flagged', async ({ browser }) => {
  const { page, dialogs } = await start(browser, { 'Warning for': false });
  await page.evaluate(() => { document.getElementById('pt1:r1:0:it1::content').id = 'pt1:r1:123456789:it1'; });
  await page.locator(id('pt1:r1:123456789:it1')).click(CTRL);
  expect(dialogs[0].message).toContain('looks auto-generated');
});

test('ids of the mock are not flagged, Generate and Print may be the same button', async ({ browser }) => {
  const context = await browser.newContext();
  const dialogs = [];
  trackDialogs(context, dialogs, { 'Text to append': 'x', 'option to select': 'You (test)' });
  await stubPrint(context);
  const page = await context.newPage();
  await learnAll(page, context);
  expect(dialogs.filter(d => d.message.startsWith('Warning for'))).toEqual([]);
});

test('summary lists every step before the configuration is saved', async ({ browser }) => {
  const context = await browser.newContext();
  const dialogs = [];
  trackDialogs(context, dialogs, { 'Text to append': 'Summary append', 'option to select': 'You (test)' });
  await stubPrint(context);
  const page = await context.newPage();
  await learnAll(page, context);
  const summary = dialogs.find(d => d.message.startsWith('Check the configuration'));
  expect(summary).toBeTruthy();
  for (const key of ['search', 'searchBtn', 'result', 'line1', 'line2', 'line3', 'user', 'save', 'gen', 'print', 'apply']) {
    expect(summary.message).toContain(key + ' - ');
  }
  expect(summary.message).toContain('save - button "Save"');
  expect(summary.message).toContain('Append text: "Summary append"');
  expect(summary.message).toContain('List option: "You (test)"');
});

test('rejecting the summary does not save the configuration', async ({ browser }) => {
  const context = await browser.newContext();
  const dialogs = [];
  trackDialogs(context, dialogs, { 'Text to append': 'x', 'option to select': 'You (test)', 'Check the configuration': false });
  await stubPrint(context);
  const page = await context.newPage();
  // full learning run, but the summary is rejected: autoCfg must stay empty
  await learnAll(page, context, { expectDone: false });
  const cfg = await page.evaluate(() => localStorage.getItem('autoCfg'));
  expect(cfg).toBeNull();
});

test('a fallback selector from stable attributes is used when the id changes', async ({ browser }) => {
  const context = await browser.newContext();
  const dialogs = [];
  trackDialogs(context, dialogs, { 'Text to append': 'Fallback append', 'option to select': 'You (test)' });
  await stubPrint(context);

  const learn = await context.newPage();
  await learnAll(learn, context, { prep: p => p.evaluate(() => document.getElementById('pt1:r1:0:it1::content').setAttribute('name', 'q')) });
  const cfg = await learn.evaluate(() => JSON.parse(localStorage.getItem('autoCfg')));
  expect(cfg.steps.search.alt).toBe('input[name="q"]');
  expect(cfg.steps.line2.alt).toBe(''); // no stable attribute there
  await learn.close();

  const page = await context.newPage();
  await page.goto(MOCK);
  await page.evaluate(() => {
    const el = document.getElementById('pt1:r1:0:it1::content');
    el.setAttribute('name', 'q');
    el.id = 'changed-id'; // the learned id selector no longer matches
  });
  await page.locator('[name="q"]').fill('5909876543210');
  const popupP = page.waitForEvent('popup');
  await page.evaluate(bookmarklet('auto'));
  const popup = await popupP;
  await expect(popup.locator('[id="log"]')).toContainText('Apply → printing', { timeout: 30000 });
});
