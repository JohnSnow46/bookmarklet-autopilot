const fs = require('fs');
const path = require('path');

const MOCK = '/mock/mock-oracle.html';
const CTRL = { modifiers: ['Control'] };

// Bookmarklet code from dist/ without the javascript: prefix (as the browser would run it).
const bookmarklet = name =>
  fs.readFileSync(path.join(__dirname, '..', 'dist', name + '.txt'), 'utf8').replace(/^javascript:/, '');

// Records every dialog (alert/confirm/prompt) and accepts it.
// answers: { message fragment: answer for a prompt, or false to dismiss the dialog }
function trackDialogs(context, dialogs, answers = {}) {
  const hook = page => page.on('dialog', d => {
    dialogs.push({ type: d.type(), message: d.message() });
    const k = Object.keys(answers).find(x => d.message().includes(x));
    if (k !== undefined && answers[k] === false) return d.dismiss();
    return d.accept(k === undefined ? undefined : answers[k]);
  });
  context.pages().forEach(hook);
  context.on('page', hook);
}

// The print dialog is replaced by a stub that only counts calls.
async function stubPrint(context) {
  await context.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
}

const id = s => '[id="' + s + '"]';

// Full learning run on the mock: Ctrl+click teaches, a plain click moves the process on.
async function learnAll(page, context, { code = '5901234123457', skipUser = false, variant = '', prep, expectDone = true } = {}) {
  await page.goto(MOCK + (variant ? '?variant=' + variant : ''));
  if (prep) await prep(page);
  await page.evaluate(bookmarklet('learn'));

  await page.locator(id('pt1:r1:0:it1::content')).click(CTRL);
  await page.locator('[data-c="' + code + '"]').click();
  await page.locator(id('pt1:r1:0:cb1')).click(CTRL);
  await page.locator(id('pt1:r1:0:cb1')).click();
  await page.locator('a.xResult').click(CTRL);
  await page.locator('a.xResult').click();

  await page.locator(id('pt1:r2:0:it1::content')).click(CTRL);
  await page.locator(id('pt1:r2:0:it2::content')).click(CTRL);
  await page.locator(id('pt1:r2:0:it3::content')).click(CTRL);
  if (skipUser) await page.locator('[id="__learn"] button', { hasText: 'Skip' }).click();
  else await page.locator(id('pt1:r2:0:soc1::content')).click(CTRL);
  await page.locator(id('pt1:r2:0:it2::content')).fill(await page.locator(id('pt1:r2:0:it1::content')).inputValue());
  await page.locator(id('pt1:r2:0:it3::content')).fill('appended');
  if (!skipUser) await page.locator(id('pt1:r2:0:soc1::content')).selectOption({ label: 'You (test)' });

  await page.locator(id('pt1:r2:0:cb_save')).click(CTRL);
  await page.locator(id('pt1:r2:0:cb_save')).click();
  const gen = page.locator(id('pt1:r3:0:cb_gen'));
  await gen.click(CTRL);
  await gen.click();
  await page.waitForFunction(() => document.getElementById('pt1:r3:0:cb_gen').textContent.trim() === 'Print');
  await gen.click(CTRL);

  const popupP = page.waitForEvent('popup');
  await gen.click();
  const popup = await popupP;
  await popup.waitForLoadState();
  await popup.evaluate(bookmarklet('learn')); // continue learning in the new tab (the confirm is accepted)
  const apply = popup.locator(id('pt1:p1:cb_apply'));
  await apply.waitFor({ timeout: 15000 });
  await apply.click(CTRL);
  await popup.locator('[id="__learn"] button', { hasText: 'Save settings' }).click();
  if (expectDone) await popup.locator('[id="__learn"]').getByText('Done').waitFor();
  else await popup.waitForTimeout(500); // let the (rejected) dialogs finish
  await popup.close();
}

module.exports = { MOCK, CTRL, bookmarklet, trackDialogs, stubPrint, learnAll, id };
