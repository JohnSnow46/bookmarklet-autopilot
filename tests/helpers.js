const fs = require('fs');
const path = require('path');

const MOCK = '/mock/demo-app.html';
const CTRL = { modifiers: ['Control'] };
const id = s => '[id="' + s + '"]';

// Bookmarklet code from dist/ without the javascript: prefix (as the browser would run it).
let source = null; // optional override, e.g. the links of the installer page
const useSource = fn => { source = fn; };
const bookmarklet = name => (source ? source(name) : fs.readFileSync(path.join(__dirname, '..', 'dist', name + '.txt'), 'utf8')).replace(/^javascript:/, '');

// Records every dialog (alert/confirm/prompt) and accepts it.
// answers: { message fragment ('=' prefix: the whole message): answer for a prompt (a string, a function of the message, or false to dismiss) }
function trackDialogs(context, dialogs, answers = {}) {
  const hook = page => page.on('dialog', d => {
    dialogs.push({ type: d.type(), message: d.message() });
    const k = Object.keys(answers).find(x => (x.startsWith('=') ? d.message() === x.slice(1) : d.message().includes(x)));
    if (k !== undefined && answers[k] === false) return d.dismiss();
    const ans = k === undefined ? undefined : answers[k];
    return d.accept(typeof ans === 'function' ? ans(d.message()) : ans);
  });
  context.pages().forEach(hook);
  context.on('page', hook);
}

// The print dialog is replaced by a stub that only counts calls.
async function stubPrint(context) {
  await context.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
}

// A fresh browser context with dialogs tracked and print stubbed.
async function newSession(browser, answers = {}) {
  const context = await browser.newContext();
  const dialogs = [];
  trackDialogs(context, dialogs, answers);
  await stubPrint(context);
  return { context, dialogs };
}

const has = (variant, v) => variant.split(',').includes(v);

// Full learning run on the mock: Ctrl+click teaches, a plain click moves the process on.
async function learnAll(page, context, { code = '5901234123457', skipUser = false, variant = '', prep, expectDone = true } = {}) {
  const reload = has(variant, 'reload'), iframe = has(variant, 'iframe');
  const form = iframe ? page.frameLocator(id('pt1:r2:0:frm')) : page;
  const learn = bookmarklet('learn');
  // after a full page reload the bookmarklet is gone: run it again (it asks to continue, the dialog is accepted)
  const nav = async view => {
    if (!reload) return;
    await page.waitForURL(new RegExp('view=' + view));
    await page.waitForLoadState('load');
    await page.evaluate(learn);
  };

  await page.goto(MOCK + (variant ? '?variant=' + variant : ''));
  if (prep) await prep(page);
  await page.evaluate(learn);

  await page.locator(id('pt1:r1:0:it1::content')).click(CTRL);
  await page.locator('[data-c="' + code + '"]').click();
  await page.locator(id('pt1:r1:0:cb1')).click(CTRL);
  await page.locator(id('pt1:r1:0:cb1')).click();
  await nav('results');
  await page.locator('a.xResult').click(CTRL);
  await page.locator('a.xResult').click();
  await nav('form');

  await form.locator(id('pt1:r2:0:it1::content')).waitFor();
  if (iframe) await page.waitForTimeout(600); // let Learn hook the freshly created frame
  await form.locator(id('pt1:r2:0:it1::content')).click(CTRL);
  await form.locator(id('pt1:r2:0:it2::content')).click(CTRL);
  await form.locator(id('pt1:r2:0:it3::content')).click(CTRL);
  const bar = page.locator('[id="__learn"]');
  const skipList = () => bar.getByRole('button', { name: 'Skip this list' }).click();
  // a searchable list: teach the opener, the search field and one result row; then really choose the row
  const learnCombo = async (p, query) => {
    await form.locator(id(p)).click(CTRL);
    await form.locator(id(p)).click();
    await form.locator(id(p + ':srch')).click(CTRL);
    await form.locator(id(p + ':srch')).fill(query);
    const row = form.locator(id(p + ':list') + ' li.opt').first();
    await row.waitFor();
    await row.click(CTRL);
    await row.click();
  };
  const combo = has(variant, 'combo'), orgcombo = has(variant, 'orgcombo');
  if (skipUser) {
    await bar.getByRole('button', { name: 'Skip', exact: true }).click(); // the normal User list
    if (combo) await learnCombo('pt1:r2:0:cmb1', 'Doe');
    else await skipList(); // person list
    if (orgcombo) await learnCombo('pt1:r2:0:cmb2', 'Org A');
    else await skipList(); // organization list
  } else {
    await form.locator(id('pt1:r2:0:soc1::content')).click(CTRL);
    await skipList(); // organization list (the person list is skipped automatically)
  }
  await form.locator(id('pt1:r2:0:it2::content')).fill(await form.locator(id('pt1:r2:0:it1::content')).inputValue());
  await form.locator(id('pt1:r2:0:it3::content')).fill('appended');
  if (!skipUser) await form.locator(id('pt1:r2:0:soc1::content')).selectOption({ label: 'You (test)' });

  await form.locator(id('pt1:r2:0:cb_save')).click(CTRL);
  await form.locator(id('pt1:r2:0:cb_save')).click();
  await nav('saved');
  const gen = page.locator(id('pt1:r3:0:cb_gen'));
  await gen.click(CTRL);
  await gen.click();
  await page.waitForFunction(() => document.getElementById('pt1:r3:0:cb_gen').textContent.trim() === 'Print');
  await gen.click(CTRL);

  const popupP = page.waitForEvent('popup');
  await gen.click();
  const popup = await popupP;
  await popup.waitForLoadState();
  await popup.evaluate(learn); // continue learning in the new tab (the confirm is accepted)
  const apply = popup.locator(id('pt1:p1:cb_apply'));
  await apply.waitFor({ timeout: 15000 });
  await apply.click(CTRL);
  await popup.locator('[id="__learn"]').getByRole('button', { name: 'Skip', exact: true }).click(); // optional step: error message
  await popup.locator('[id="__learn"] button', { hasText: 'Save settings' }).click();
  if (expectDone) await popup.locator('[id="__learn"]').getByText('Done').waitFor();
  else await popup.waitForTimeout(500); // let the (rejected) dialogs finish
  await popup.close();
}

// Scans a code and runs Auto. With reload = true Auto is clicked again after every full page reload
// (the way a person has to) until the print tab opens. Returns the print tab.
async function autoRun(page, { code = '5909876543210', reload = false, bm = 'auto', scan } = {}) {
  let popup = null;
  page.on('popup', p => { popup = p; });
  if (scan) await page.locator(id('pt1:r1:0:it1::content')).fill(scan); // typed like a scanner
  else await page.locator('[data-c="' + code + '"]').click();
  for (let i = 0; i < (reload ? 8 : 1) && !popup; i++) {
    const url0 = page.url();
    await page.evaluate(bookmarklet(bm));
    const t0 = Date.now();
    while (!popup && page.url() === url0 && Date.now() - t0 < 30000) await page.waitForTimeout(200);
    if (!popup) await page.waitForLoadState('load');
  }
  if (!popup) throw new Error('the print tab never opened');
  return popup;
}

// The text of the first dialog (alert) that starts with the given prefix; waits for it.
async function waitDialog(dialogs, prefix, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const d = dialogs.find(x => x.message.startsWith(prefix));
    if (d) return d.message;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('no dialog starting with "' + prefix + '"; got: ' + JSON.stringify(dialogs.map(d => d.message)));
}

module.exports = { useSource, MOCK, CTRL, bookmarklet, trackDialogs, stubPrint, newSession, learnAll, autoRun, waitDialog, id };
