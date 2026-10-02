const fs = require('fs');
const path = require('path');

const MOCK = '/mock/makieta-oracle.html';
const CTRL = { modifiers: ['Control'] };

// Kod bookmarkletu z dist/ bez prefiksu javascript: (tak jak wykonałaby go przeglądarka).
const bookmarklet = name =>
  fs.readFileSync(path.join(__dirname, '..', 'dist', name + '.txt'), 'utf8').replace(/^javascript:/, '');

// Zbiera wszystkie okna dialogowe (alert/confirm) i domyślnie je akceptuje.
function trackDialogs(context, dialogs, accept = () => true) {
  const hook = page => page.on('dialog', d => {
    dialogs.push({ type: d.type(), message: d.message() });
    return accept(d) ? d.accept() : d.dismiss();
  });
  context.pages().forEach(hook);
  context.on('page', hook);
}

// Okno drukowania zastępujemy stubem, który tylko zlicza wywołania.
async function stubPrint(context) {
  await context.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
}

const id = s => '[id="' + s + '"]';

// Pełna nauka na makiecie: Ctrl+klik uczy, zwykły klik przesuwa proces dalej.
async function learnAll(page, context, { code = '5901234123457', skipUser = false } = {}) {
  await page.goto(MOCK);
  await page.evaluate(bookmarklet('naucz'));

  await page.locator(id('pt1:r1:0:it1::content')).click(CTRL);
  await page.locator('[data-c="' + code + '"]').click();
  await page.locator(id('pt1:r1:0:cb1')).click(CTRL);
  await page.locator(id('pt1:r1:0:cb1')).click();
  await page.locator('a.xResult').click(CTRL);
  await page.locator('a.xResult').click();

  await page.locator(id('pt1:r2:0:it1::content')).click(CTRL);
  await page.locator(id('pt1:r2:0:it2::content')).click(CTRL);
  await page.locator(id('pt1:r2:0:it3::content')).click(CTRL);
  await page.locator(id('pt1:r2:0:soc1::content')).click(CTRL);
  await page.locator(id('pt1:r2:0:it2::content')).fill(await page.locator(id('pt1:r2:0:it1::content')).inputValue());
  await page.locator(id('pt1:r2:0:it3::content')).fill('dopisek');
  await page.locator(id('pt1:r2:0:soc1::content')).selectOption({ label: 'Ty (test)' });

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
  await popup.evaluate(bookmarklet('naucz')); // kontynuacja nauki w nowej karcie (confirm akceptowany)
  const apply = popup.locator(id('pt1:p1:cb_apply'));
  await apply.waitFor({ timeout: 15000 });
  await apply.click(CTRL);
  await popup.close();
}

module.exports = { MOCK, CTRL, bookmarklet, trackDialogs, stubPrint, learnAll, id };
