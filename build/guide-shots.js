// Screenshots for docs/GUIDE.md: walks through the installer and the demo app with the built bookmarklets.
// Usage: npm run build, npm run serve (in another terminal), then npm run shots
const fs = require('fs'), path = require('path');
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:8000';
const OUT = path.join(__dirname, '..', 'docs', 'guide');
const bm = n => fs.readFileSync(path.join(__dirname, '..', 'dist', n + '.txt'), 'utf8').replace(/^javascript:/, '');
const id = s => '[id="' + s + '"]';

// Native dialogs cannot be captured, so their real text is drawn as an overlay for the picture.
const drawDialog = (page, text, buttons = ['OK']) => page.evaluate(([text, buttons]) => {
  const d = document.createElement('div');
  d.id = '__shotdlg';
  d.style.cssText = 'position:fixed;left:50%;top:24px;transform:translateX(-50%);width:460px;background:#fff;color:#1f1f1f;'
    + 'border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.35);padding:20px 22px;font:14px/1.45 system-ui,Segoe UI,Arial;z-index:2147483647';
  const h = document.createElement('div'); h.textContent = location.host + ' says'; h.style.cssText = 'font-weight:600;margin-bottom:8px';
  const p = document.createElement('div'); p.textContent = text; p.style.cssText = 'white-space:pre-wrap;max-height:420px;overflow:hidden';
  const r = document.createElement('div'); r.style.cssText = 'text-align:right;margin-top:16px';
  buttons.forEach((b, i) => { const x = document.createElement('span'); x.textContent = b;
    x.style.cssText = 'display:inline-block;margin-left:8px;padding:7px 18px;border-radius:16px;' + (i === buttons.length - 1 ? 'background:#0b57d0;color:#fff' : 'border:1px solid #c4c7c5;color:#0b57d0'); r.appendChild(x); });
  d.append(h, p, r); document.body.appendChild(d);
}, [text, buttons]);
const clearDialog = page => page.evaluate(() => { const d = document.getElementById('__shotdlg'); if (d) d.remove(); });

// A red frame and a number on the element the reader should click.
const mark = (loc, n) => loc.evaluate((el, n) => {
  const r = el.getBoundingClientRect(), d = el.ownerDocument;
  const box = d.createElement('div'); box.className = '__shotmark';
  box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:3px solid #d93025;border-radius:6px;'
    + 'left:' + (r.left - 5) + 'px;top:' + (r.top - 5) + 'px;width:' + (r.width + 4) + 'px;height:' + (r.height + 4) + 'px';
  if (n) { const b = d.createElement('div'); b.textContent = n;
    b.style.cssText = 'position:absolute;left:-14px;top:-14px;width:24px;height:24px;border-radius:50%;background:#d93025;color:#fff;font:bold 14px/24px Arial;text-align:center';
    box.appendChild(b); }
  d.body.appendChild(box);
}, n);
const unmark = page => page.evaluate(() => document.querySelectorAll('.__shotmark').forEach(e => e.remove()));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1180, height: 520 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => { window.print = () => {}; });
  const dialogs = [];
  let answer = () => undefined; // per phase: message -> prompt answer, false = Cancel
  context.on('page', p => p.on('dialog', d => {
    dialogs.push(d.message());
    const a = answer(d.message());
    return a === false ? d.dismiss() : d.accept(a);
  }));
  const shot = async (page, name, opts = {}) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, name + '.png'), ...opts }); console.log(name); };
  const lastDialog = prefix => dialogs.filter(m => m.startsWith(prefix)).pop();

  // 1. Installer
  const inst = await context.newPage();
  await inst.setViewportSize({ width: 1180, height: 700 });
  await inst.goto(BASE + '/docs/index.html');
  await shot(inst, '01-installer');
  await inst.locator('.card').nth(1).scrollIntoViewIfNeeded();
  await inst.evaluate(() => window.scrollBy(0, -60));
  await mark(inst.locator('a.bm').first(), 1);
  await mark(inst.locator('button[data-copy]').first(), 2);
  await shot(inst, '02-installer-record');
  await inst.close();

  // 2. Demo app
  const page = await context.newPage();
  await page.goto(BASE + '/mock/demo-app.html');
  await shot(page, '03-demo-app');

  // 3. Record
  await page.evaluate(bm('record'));
  await page.locator(id('__record')).waitFor();
  await shot(page, '04-record-bar');
  await page.locator(id('pt1:r1:0:it1::content')).fill('5901234123457'); // typed or scanned
  await mark(page.locator(id('pt1:r1:0:cb1')), 1);
  await shot(page, '05-record-scan');
  await unmark(page);
  await page.locator(id('pt1:r1:0:cb1')).click();
  await page.locator('a.xResult').waitFor();
  await mark(page.locator('a.xResult').first(), 2);
  await shot(page, '06-record-results');
  await unmark(page);
  await page.locator('a.xResult').first().click();
  const f1 = page.locator(id('pt1:r2:0:it1::content'));
  await f1.waitFor();
  await page.locator(id('pt1:r2:0:it2::content')).fill(await f1.inputValue());
  await page.locator(id('pt1:r2:0:it2::content')).blur();
  await page.locator(id('pt1:r2:0:it3::content')).fill('Checked');
  await page.locator(id('pt1:r2:0:it3::content')).blur();
  await page.locator(id('pt1:r2:0:soc1::content')).selectOption({ label: 'You (test)' });
  await mark(page.locator(id('pt1:r2:0:cb_save')), 3);
  await shot(page, '07-record-form');
  await unmark(page);
  await page.locator(id('pt1:r2:0:cb_save')).click();
  const gen = page.locator(id('pt1:r3:0:cb_gen'));
  await gen.click();
  await page.waitForFunction(() => document.getElementById('pt1:r3:0:cb_gen').textContent.trim() === 'Print');
  const popupP = page.waitForEvent('popup');
  await gen.click();
  const popup = await popupP;
  await popup.waitForLoadState();
  await popup.evaluate(bm('record'));
  await popup.locator(id('__record')).waitFor();
  await mark(popup.locator(id('pt1:p1:cb_apply')), 4);
  await shot(popup, '08-record-new-tab');
  await unmark(popup);
  await popup.locator(id('pt1:p1:cb_apply')).click();
  await mark(popup.locator(id('__record')).getByRole('button', { name: 'Stop and review' }), 5);
  await shot(popup, '09-record-stop');
  await unmark(popup);
  dialogs.length = 0;
  await popup.locator(id('__record')).getByRole('button', { name: 'Stop and review' }).click();
  await popup.locator(id('__record')).getByText('Done!').waitFor();
  // the review questions, shown with their real text
  const steps = dialogs.filter(m => m.startsWith('Step '));
  const review = [['10-review-remove', lastDialog('Recorded')], ['11a-review-row', steps[0]], ['11b-review-user', steps[1]],
    ['12-review-save', lastDialog('Ask "Save?"')], ['13-review-confirm', lastDialog('Save this recording?')]];
  const bar = v => popup.evaluate(v => { document.getElementById('__record').style.visibility = v; }, v);
  await bar('hidden'); // the review questions come before "Done!"
  for (const [name, m] of review) {
    if (!m) { console.log('no dialog for ' + name); continue; }
    await drawDialog(popup, m, ['Cancel', 'OK']);
    await shot(popup, name);
    await clearDialog(popup);
  }
  await bar('');
  await shot(popup, '14-record-done');
  await popup.close();

  // 4. Dry run on the start screen
  await page.goto(BASE + '/mock/demo-app.html');
  dialogs.length = 0;
  await page.evaluate(bm('dryrun'));
  for (let i = 0; i < 50 && !lastDialog('Dry run'); i++) await page.waitForTimeout(200);
  await drawDialog(page, lastDialog('Dry run'));
  await shot(page, '15-dry-run');
  await clearDialog(page);

  // 5. Play: stop at "Save?" (Cancel) to show the filled form, then a full run
  answer = m => (m === 'Save?' ? false : undefined);
  await page.locator(id('pt1:r1:0:it1::content')).fill('5909876543210');
  await mark(page.locator(id('pt1:r1:0:it1::content')), 1);
  await shot(page, '16-play-scan');
  await unmark(page);
  dialogs.length = 0;
  await page.evaluate(bm('play'));
  for (let i = 0; i < 150 && !dialogs.includes('Save?'); i++) await page.waitForTimeout(200);
  await page.waitForTimeout(500);
  await drawDialog(page, 'Save?', ['Cancel', 'OK']);
  await shot(page, '17-play-save');
  await clearDialog(page);

  answer = () => undefined;
  await page.goto(BASE + '/mock/demo-app.html');
  let printTab = null;
  context.once('page', p => { printTab = p; });
  await page.locator(id('pt1:r1:0:it1::content')).fill('5909876543210');
  await page.evaluate(bm('play'));
  for (let i = 0; i < 150 && !printTab; i++) await page.waitForTimeout(200);
  await printTab.locator(id('log')).getByText('Apply → printing').waitFor({ timeout: 30000 });
  await shot(printTab, '18-play-done');
  await printTab.close();

  // 6. Series
  await page.goto(BASE + '/mock/demo-app.html');
  dialogs.length = 0;
  await page.evaluate(bm('series'));
  await page.locator(id('__series')).waitFor();
  await page.waitForTimeout(500);
  await mark(page.locator(id('__series')), 1);
  await shot(page, '19-series-wait');
  await unmark(page);
  await page.locator(id('__series')).getByRole('button', { name: 'Stop' }).click();
  await page.waitForTimeout(800);

  // 7. Show: recorded steps and run log
  dialogs.length = 0;
  answer = m => (m.startsWith('Keep the run log') ? undefined : m.startsWith('Change the profiles') ? false : undefined);
  await page.evaluate(bm('show'));
  for (let i = 0; i < 25 && !lastDialog('Run log'); i++) await page.waitForTimeout(200);
  await drawDialog(page, lastDialog('Recorded steps'));
  await shot(page, '20-show-steps');
  await clearDialog(page);
  if (lastDialog('Run log')) { await drawDialog(page, lastDialog('Run log')); await shot(page, '21-show-log'); await clearDialog(page); }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
