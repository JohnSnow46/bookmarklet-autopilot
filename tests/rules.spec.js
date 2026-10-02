const { test, expect } = require('@playwright/test');
const { MOCK, CTRL, bookmarklet, newSession, learnAll, waitDialog, id } = require('./helpers');

const ANSWERS = { 'Text to append': 'Rule test append', 'option to select': 'You (test)' };
const SEARCH = id('pt1:r1:0:it1::content');
const bar = page => page.locator('[id="__validate"]');

async function learned(browser, answers = ANSWERS) {
  const s = await newSession(browser, { ...answers });
  const learn = await s.context.newPage();
  await learnAll(learn, s.context);
  await learn.close();
  s.dialogs.length = 0;
  return s;
}

test('Learn creates the default rules and shows them in the summary', async ({ browser }) => {
  const s = await newSession(browser, ANSWERS);
  const page = await s.context.newPage();
  await learnAll(page, s.context);
  const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('autoCfg')));
  expect(cfg.v).toBe(3);
  expect(cfg.rules.map(r => r.type + ':' + r.a.label + ':' + r.when)).toEqual([
    'equal:line1:beforeSave', 'notEmpty:line3:beforeSave', 'notEmpty:user:beforeSave',
  ]);
  const summary = s.dialogs.find(d => d.message.startsWith('Check the configuration'));
  expect(summary.message).toContain('"line1" equals "line2" [before Save]');
});

test('a failing rule stops Auto before Save and nothing is saved', async ({ browser }) => {
  const s = await learned(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK + '?variant=mangle'); // the "framework" upper-cases the pasted line
  await page.locator('[data-c="5901234123457"]').click();
  await page.evaluate(bookmarklet('auto'));
  const msg = await waitDialog(s.dialogs, 'Auto stopped');
  expect(msg).toContain('validation before Save');
  expect(msg).toContain('Rule 1 (equal)');
  expect(msg).toContain('"line1" is "PCB-R10-MAIN rev.B" but "line2" is "PCB-R10-MAIN REV.B"');
  const log = await page.locator('[id="log"]').textContent();
  expect(log).not.toContain('Saved document');
  expect(log).not.toContain('Save rejected');
  expect(s.dialogs.some(d => d.message === 'Save?')).toBe(false); // it never got as far as the question
});

test('an application error after Save stops Auto with the error text', async ({ browser }) => {
  const s = await learned(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK + '?variant=saveerror');
  await page.locator('[data-c="5909876543210"]').click();
  let popup = false;
  page.on('popup', () => { popup = true; });
  await page.evaluate(bookmarklet('auto'));
  const msg = await waitDialog(s.dialogs, 'Auto stopped');
  expect(msg).toContain('after Save');
  expect(msg).toContain('The application reported an error after Save');
  expect(msg).toContain('ORA-00001');
  const log = await page.locator('[id="log"]').textContent();
  expect(log).toContain('Save failed (simulated)');
  expect(log).not.toContain('Print: opening new tab');
  expect(popup).toBe(false);
});

test('Validate builds rules with Ctrl+click, Check runs the manual ones, any page', async ({ browser }) => {
  const answers = {};
  const s = await newSession(browser, answers);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('validate'));

  const add = async (typeLabel, text, when = 'manual only') => {
    if (text !== undefined) answers[typeLabel.includes('regex') ? 'Regular expression' : 'Text:'] = text;
    await bar(page).getByRole('button', { name: 'Add rule' }).click();
    await bar(page).getByRole('button', { name: typeLabel, exact: true }).click();
    await page.locator(SEARCH).click(CTRL);
    await bar(page).getByRole('button', { name: when, exact: true }).click();
    await expect(bar(page)).toContainText('Added:');
  };
  await add('A is not empty');
  await add('A equals a text', '5901234123457');
  await add('A contains a text', '1234');
  await add('A contains a text', 'zzz');
  await add('A matches a regex', '^\\d{13}$');
  await add('A matches a regex', '^x');
  await expect(bar(page)).toContainText('6 rule(s)');

  // empty field: the "not empty" rule fails too
  s.dialogs.length = 0;
  await page.evaluate(bookmarklet('check'));
  let msg = await waitDialog(s.dialogs, 'Failed');
  expect(msg).toContain('Rule 1 (notEmpty): "Product code" is empty');

  await page.locator('[data-c="5901234123457"]').click();
  s.dialogs.length = 0;
  await page.evaluate(bookmarklet('check'));
  msg = await waitDialog(s.dialogs, 'Failed');
  expect(msg).not.toContain('Rule 1 ');
  expect(msg).not.toContain('Rule 2 ');
  expect(msg).not.toContain('Rule 3 ');
  expect(msg).toContain('Rule 4 (contains)');
  expect(msg).toContain('Rule 6 (matches)');
  expect(msg).not.toContain('Rule 5 ');

  // "Check now" in the bar checks every rule, whatever its moment
  s.dialogs.length = 0;
  await bar(page).getByRole('button', { name: 'Check now' }).click();
  expect(await waitDialog(s.dialogs, 'Failed')).toContain('Rule 4 (contains)');

  // delete the failing ones through the Rules list
  for (const n of ['6', '4']) {
    answers['Number of a rule'] = n;
    await bar(page).getByRole('button', { name: 'Rules' }).click();
    await expect(bar(page)).toContainText('Rule deleted.');
  }
  s.dialogs.length = 0;
  await page.evaluate(bookmarklet('check'));
  expect(await waitDialog(s.dialogs, 'All')).toBe('All 4 rule(s) passed.');
});

test('Validate: a regular expression that does not compile is refused', async ({ browser }) => {
  const s = await newSession(browser, { 'Regular expression': '([' });
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('validate'));
  await bar(page).getByRole('button', { name: 'Add rule' }).click();
  await bar(page).getByRole('button', { name: 'A matches a regex', exact: true }).click();
  await waitDialog(s.dialogs, 'Invalid regular expression');
  await expect(bar(page)).toContainText('0 rule(s)');
});

test('Check without manual rules says so', async ({ browser }) => {
  const s = await newSession(browser);
  const page = await s.context.newPage();
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('check'));
  expect(await waitDialog(s.dialogs, 'No "manual only" rules')).toContain('Validate');
});
