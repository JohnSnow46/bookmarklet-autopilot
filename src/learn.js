// Learning steps. type: input | button | select | link, optional: can be skipped.
const STEPS = [
  { key: 'search', desc: 'the code search field', type: 'input' },
  { key: 'searchBtn', desc: 'the Search button', type: 'button' },
  { key: 'result', desc: 'the search result (product)', type: 'link' },
  { key: 'line1', desc: 'the line to copy', type: 'input' },
  { key: 'line2', desc: 'the field you paste into', type: 'input' },
  { key: 'line3', desc: 'the field you append to', type: 'input' },
  { key: 'user', desc: 'the User list', type: 'select', optional: true },
  { key: 'save', desc: 'the Save button', type: 'button' },
  { key: 'gen', desc: 'the Generate button', type: 'button' },
  { key: 'print', desc: 'the Print button', type: 'button' },
  { key: 'apply', desc: 'the Apply button (in the new tab)', type: 'button' },
];
const K = 'autoLearn';
const prevCfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
let st = JSON.parse(localStorage.getItem(K) || 'null');
if (st && !st.steps) st = null; // old learning-state format

if (st && st.done) {
  if (!confirm('A configuration already exists. Learn from scratch?')) return;
  st = null;
} else if (st && st.i > 0) {
  if (!confirm('Continue from step ' + Math.min(st.i + 1, STEPS.length) + '? (Cancel = start over)')) st = null;
}
if (!st) st = { i: 0, steps: {}, done: false };

const old = document.getElementById('__learn');
if (old) old.remove();
const b = document.createElement('div');
b.id = '__learn';
b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgb(31,111,178);color:white;font:15px Arial;padding:10px 14px';
document.body.appendChild(b);

const store = () => localStorage.setItem(K, JSON.stringify(st));

// What kind of control is this element: input | select | button | link | other.
const kindOf = el => {
  const t = el.tagName.toLowerCase();
  if (t === 'select') return 'select';
  if (t === 'textarea') return 'input';
  if (t === 'input') {
    if (/^(button|submit|reset|image)$/.test(el.type)) return 'button';
    return /^(checkbox|radio|file)$/.test(el.type) ? 'other' : 'input';
  }
  if (t === 'a') return 'link';
  return t === 'button' || el.getAttribute('role') === 'button' ? 'button' : 'other';
};
// Links and buttons are interchangeable (apps often style one as the other).
const kindOk = (kind, type) => kind === type || (kind === 'link' && type === 'button') || (kind === 'button' && type === 'link');

// A selector from stable attributes only (used by Auto when the id selector stops matching).
const altSel = el => {
  const t = el.tagName.toLowerCase();
  for (const a of ['name', 'aria-label', 'data-testid', 'data-automation-id', 'title', 'placeholder']) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const s = t + '[' + a + '="' + v.replace(/(["\\])/g, '\\$1') + '"]';
    try { if (document.querySelectorAll(s).length === 1) return s; } catch (_) {}
  }
  return '';
};

// Everything suspicious about the picked element; the user is asked to confirm when this is not empty.
const warnings = (el, key, type, sel) => {
  const w = [];
  const kind = kindOf(el);
  if (!kindOk(kind, type)) w.push('This looks like ' + (kind === 'other' ? 'something else' : 'a ' + kind) + ', but this step expects ' + (type === 'input' ? 'an input' : 'a ' + type) + '. Steps may be shifted by one.');
  for (const [k, c] of Object.entries(st.steps)) {
    if (c.sel === sel && ![key, k].every(x => x === 'gen' || x === 'print')) {
      w.push('The same element was already picked for the "' + k + '" step.');
    }
  }
  let n = 0;
  try { n = [...document.querySelectorAll(sel)].filter(x => x.offsetParent !== null).length; } catch (_) {}
  if (n > 1) w.push('The selector matches ' + n + ' visible elements, Auto may click the wrong one.');
  const anchor = el.closest('[id]');
  if (anchor && /\d{5,}|[0-9a-f]{12,}/i.test(anchor.id)) w.push('The id "' + anchor.id + '" looks auto-generated and may change between sessions.');
  return w;
};

const pick = e => {
  if (!e.ctrlKey || b.contains(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.type !== 'mousedown' || st.i >= STEPS.length) return;
  const el = e.target.closest('button,a,input,select,textarea,[role=button]') || e.target;
  const s = STEPS[st.i], key = s.key, sel = cssPath(el);
  const w = warnings(el, key, s.type, sel);
  if (w.length && !confirm('Warning for ' + s.desc + ':\n- ' + w.join('\n- ') + '\n\nAre you sure?')) return;
  // Store the visible text only where Auto needs it (button captions), never e.g. a product name.
  st.steps[key] = { sel, alt: altSel(el), tag: kindOf(el), text: TXT.includes(key) ? el.textContent.trim() : '' };
  el.style.outline = '3px solid rgb(46,125,50)';
  setTimeout(() => { el.style.outline = ''; }, 800);
  st.i++;
  store();
  draw();
};

const off = () => {
  document.removeEventListener('mousedown', pick, true);
  document.removeEventListener('click', pick, true);
};

const mk = (t, f) => {
  const x = document.createElement('button');
  x.textContent = t;
  x.style.marginLeft = '10px';
  x.onclick = f;
  b.appendChild(x);
};

const back = () => {
  if (st.i > 0) { st.i--; delete st.steps[STEPS[st.i].key]; store(); draw(); }
};

// At the end of learning: ask for the data Auto types in and save the configuration.
const finish = () => {
  const o = (prevCfg && prevCfg.opts) || {};
  const extra = prompt('Text to append (' + STEPS[5].desc + '):', o.extraLine || '');
  if (extra === null) return;
  if (!extra.trim()) { alert('The appended text cannot be empty.'); return; }
  let userOption = '';
  if (!st.steps.user.skipped) {
    const u = prompt('Name of the option to select in the User list (exactly as shown):', o.userOption || '');
    if (u === null) return;
    if (!u.trim()) { alert('The option name cannot be empty. If there is no list, go Back and skip that step.'); return; }
    userOption = u.trim();
  }
  const lines = STEPS.map((s, i) => {
    const c = st.steps[s.key];
    return (i + 1) + '. ' + s.key + ' - ' + (c.skipped ? 'skipped' : c.tag + (c.text ? ' "' + c.text + '"' : '') + (c.alt ? ' (+ fallback)' : ''));
  });
  if (!confirm('Check the configuration:\n' + lines.join('\n') + '\n\nAppend text: "' + extra + '"' + (userOption ? '\nList option: "' + userOption + '"' : '') + '\n\nSave it?')) return;
  const confirmSave = confirm('Ask "Save?" before every Save? (OK = yes, Cancel = no)');
  localStorage.setItem('autoCfg', JSON.stringify({
    v: 2,
    steps: st.steps,
    opts: { extraLine: extra, userOption, confirmSave },
  }));
  st.done = true;
  store();
  draw();
};

const draw = () => {
  b.innerHTML = '';
  b.style.background = 'rgb(31,111,178)';
  if (st.done) {
    off();
    b.style.background = 'rgb(46,125,50)';
    b.innerHTML = '<b>Done!</b> Configuration saved. You can use Auto.';
    setTimeout(() => b.remove(), 5000);
    return;
  }
  if (st.i >= STEPS.length) {
    b.innerHTML = '<b>All steps picked.</b> Only saving the settings is left.';
    mk('Save settings', finish);
    mk('Back', back);
    return;
  }
  const s = STEPS[st.i];
  b.innerHTML = '<b>Learn ' + (st.i + 1) + '/' + STEPS.length + ':</b> Ctrl+click on: <u>' + s.desc + '</u>'
    + (s.optional ? ' (optional)' : '') + ' (a plain click works normally)';
  if (s.optional) mk('Skip', () => { st.steps[s.key] = { skipped: true }; st.i++; store(); draw(); });
  mk('Back', back);
  mk('Quit', () => { off(); b.remove(); });
};

document.addEventListener('mousedown', pick, true);
document.addEventListener('click', pick, true);
draw();
