// Shared helpers. The build prepends this file to every script (one shared scope).
const H = /*@__PURE__*/String.fromCharCode(35); // the hash character without typing it in the source
const TXT = ['searchBtn', 'save', 'gen', 'print', 'apply']; // steps that are also recognised by their button text
// Visible elements that usually carry an application error message (best effort heuristic).
const ERR_SEL = '[role="alert"],.error,.errors,.err,.alert-danger,.alert-error,.p_AFError';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const waitFor = async (fn, what, t = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < t) {
    let r = null;
    try { r = fn(); } catch (_) {}
    if (r) return r;
    await sleep(150);
  }
  throw new Error('Element did not appear: ' + what);
};

// Like waitFor, but stops early with the text returned by bad() (an application error).
const waitForOr = async (ok, bad, what, t = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < t) {
    let r = null, e = null;
    try { r = ok(); } catch (_) {}
    if (r) return r;
    try { e = bad(); } catch (_) {}
    if (e) throw new Error('The application reported an error after Save: ' + e);
    await sleep(150);
  }
  throw new Error('Element did not appear: ' + what);
};

// Sets the value with the native setter and fires the events the framework listens to.
const winOf = el => el.ownerDocument.defaultView;
const setVal = (el, v) => {
  const W = winOf(el); // elements inside an iframe belong to another window with its own prototypes
  const p = el instanceof W.HTMLTextAreaElement ? W.HTMLTextAreaElement.prototype
    : el instanceof W.HTMLSelectElement ? W.HTMLSelectElement.prototype
    : W.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v);
  el.dispatchEvent(new W.Event('input', { bubbles: true }));
  el.dispatchEvent(new W.Event('change', { bubbles: true }));
};

const shown = el => el.getClientRects().length > 0 && winOf(el).getComputedStyle(el).visibility !== 'hidden';

// The document, plus every same-origin iframe inside it (recursively).
const allDocs = (d = document, out = []) => {
  out.push(d);
  d.querySelectorAll('iframe,frame').forEach(f => { try { if (f.contentDocument) allDocs(f.contentDocument, out); } catch (_) {} });
  return out;
};

// The document at the end of a frame path (selectors of the iframes, outermost first); null if not reachable.
const docFor = (frame, d = document) => {
  for (const f of frame || []) {
    let fe = null;
    try { fe = d.querySelector(f); d = fe && fe.contentDocument; } catch (_) { d = null; }
    if (!d) return null;
  }
  return d;
};

// Selectors of the iframes between the bookmarklet's page and the element.
const framePath = el => {
  const p = [];
  let w = winOf(el);
  while (w !== window && w.frameElement) { p.unshift(cssPath(w.frameElement)); w = winOf(w.frameElement); }
  return p;
};

// Element for a stored locator {frame, sel, alt}: the main selector first, then the stable-attribute fallback.
const locate = (c, d = document) => {
  const dd = docFor(c.frame, d);
  if (!dd) return null;
  try { return dd.querySelector(c.sel) || (c.alt ? dd.querySelector(c.alt) : null); } catch (_) { return null; }
};

// Finds the visible, enabled element stored under key k (null if it is not there).
const find = (cfg, k, d = document) => {
  const c = cfg[k];
  if (!c || c.skipped) throw new Error('Missing in configuration: ' + k);
  const el = locate(c, d);
  if (!el || el.disabled || !shown(el)) return null;
  if (TXT.includes(k) && c.text && el.textContent.trim() !== c.text) return null;
  return el;
};

// base64 with UTF-8 support
const enc = s => btoa(unescape(encodeURIComponent(s)));
const dec = b => decodeURIComponent(escape(atob(b)));

// CSS selector of an element: from the nearest id upwards, then :nth-of-type.
const cssPath = el => {
  const p = [];
  while (el && el.nodeType === 1) {
    if (el.id) { p.unshift(H + CSS.escape(el.id)); break; }
    let i = 1, s = el;
    while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
    p.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
    el = el.parentElement;
  }
  return p.join('>');
};

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
// Links and buttons are interchangeable (apps often style one as the other); 'any' accepts everything.
const kindOk = (kind, type) => type === 'any' || kind === type
  || (kind === 'link' && type === 'button') || (kind === 'button' && type === 'link');

// A selector from stable attributes only (used when the id selector stops matching).
const altSel = el => {
  const t = el.tagName.toLowerCase();
  for (const a of ['name', 'aria-label', 'data-testid', 'data-automation-id', 'title', 'placeholder']) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const s = t + '[' + a + '="' + v.replace(/(["\\])/g, '\\$1') + '"]';
    try { if (el.ownerDocument.querySelectorAll(s).length === 1) return s; } catch (_) {}
  }
  return '';
};

// A short human label of a field (aria-label, name, <label>, placeholder, id).
const labelOf = el => {
  let t = el.getAttribute('aria-label') || el.getAttribute('name') || '';
  if (!t && el.id) {
    const l = el.ownerDocument.querySelector('label[for="' + el.id.replace(/(["\\])/g, '\\$1') + '"]');
    if (l) t = l.textContent;
  }
  if (!t) t = el.getAttribute('placeholder') || el.id || el.tagName.toLowerCase();
  return t.trim().slice(0, 40);
};

// What Learn and Validate store about a picked element.
const describe = el => ({ frame: framePath(el), sel: cssPath(el), alt: altSel(el), tag: kindOf(el) });

// A fixed bar at the top of the page.
const makeBar = id => {
  const old = document.getElementById(id);
  if (old) old.remove();
  const b = document.createElement('div');
  b.id = id;
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgb(31,111,178);color:white;font:15px Arial;padding:10px 14px';
  document.body.appendChild(b);
  return b;
};
const barButton = (b, text, fn) => {
  const x = document.createElement('button');
  x.textContent = text;
  x.style.marginLeft = '10px';
  x.onclick = fn;
  b.appendChild(x);
};

// Calls handler for mousedown/click (capture phase) in the page and in every same-origin iframe, including
// frames that load later or reload. Returns a function that removes the handler again.
const hookPicker = (handler, types = ['mousedown', 'click']) => {
  const seen = new Set();
  const run = () => allDocs().forEach(d => {
    if (seen.has(d)) return;
    seen.add(d);
    types.forEach(t => d.addEventListener(t, handler, true));
  });
  run();
  const t = setInterval(run, 250);
  return () => {
    clearInterval(t);
    seen.forEach(d => { try { types.forEach(t => d.removeEventListener(t, handler, true)); } catch (_) {} });
  };
};

/* ---------- validation rules ---------- */
const WHEN = { beforeSave: 'before Save', beforeGenerate: 'before Generate', manual: 'manual only' };
const RULE_TYPES = {
  equal: { label: 'A equals B', two: true },
  notEqual: { label: 'A differs from B', two: true },
  notEmpty: { label: 'A is not empty' },
  equalsText: { label: 'A equals a text', text: true },
  contains: { label: 'A contains a text', text: true },
  matches: { label: 'A matches a regex', text: true },
};

// Text of a field: value for inputs, the chosen option for lists (empty if none is chosen), text otherwise.
const readVal = el => {
  const t = el.tagName.toLowerCase();
  if (t === 'select') { const o = el.options[el.selectedIndex]; return el.value && o ? o.text : ''; }
  return t === 'input' || t === 'textarea' ? el.value : el.textContent;
};
const norm = (s, ci) => { s = String(s).replace(/\s+/g, ' ').trim(); return ci ? s.toLowerCase() : s; };
const short = s => (s.length > 60 ? s.slice(0, 57) + '...' : s);

const ruleText = r => {
  const a = '"' + r.a.label + '"', b = r.b ? '"' + r.b.label + '"' : '"' + short(r.text || '') + '"';
  const t = { equal: a + ' equals ' + b, notEqual: a + ' differs from ' + b, notEmpty: a + ' is not empty',
    equalsText: a + ' equals ' + b, contains: a + ' contains ' + b, matches: a + ' matches /' + (r.text || '') + '/' }[r.type];
  return t + (r.ci ? ' (ignore case)' : '') + ' [' + WHEN[r.when] + ']';
};

// '' when the rule holds, otherwise a message saying what is wrong.
const checkRule = (r, d = document) => {
  const a = locate(r.a, d), b = r.b ? locate(r.b, d) : null;
  if (!a) return 'cannot find "' + r.a.label + '"';
  if (r.b && !b) return 'cannot find "' + r.b.label + '"';
  const va = norm(readVal(a), r.ci), vb = b ? norm(readVal(b), r.ci) : norm(r.text || '', r.ci);
  const A = '"' + r.a.label + '" is "' + short(va) + '"';
  switch (r.type) {
    case 'equal': return va === vb ? '' : A + ' but "' + r.b.label + '" is "' + short(vb) + '"';
    case 'notEqual': return va !== vb ? '' : A + ' and "' + r.b.label + '" is the same';
    case 'notEmpty': return va ? '' : '"' + r.a.label + '" is empty';
    case 'equalsText': return va === vb ? '' : A + ', expected "' + short(vb) + '"';
    case 'contains': return va.includes(vb) ? '' : A + ', which does not contain "' + short(vb) + '"';
    case 'matches': return new RegExp(r.text, r.ci ? 'i' : '').test(va) ? '' : A + ', which does not match /' + r.text + '/';
  }
  return 'unknown rule type: ' + r.type;
};

// Messages of all failed rules for the given moment (when = null checks every rule).
const runRules = (rules, when, d = document) => {
  const out = [];
  (rules || []).forEach((r, i) => {
    if (when && r.when !== when) return;
    let m = '';
    try { m = checkRule(r, d); } catch (e) { m = e.message; }
    if (m) out.push('Rule ' + (i + 1) + ' (' + r.type + '): ' + m);
  });
  return out;
};

// Texts of visible error messages: the learned error element (if any) plus the heuristic selectors.
const errorTexts = errStep => {
  const out = [];
  const add = el => { const t = el && shown(el) ? el.textContent.trim() : ''; if (t) out.push(t); };
  if (errStep && !errStep.skipped) add(locate(errStep));
  allDocs().forEach(d => d.querySelectorAll(ERR_SEL).forEach(add));
  return [...new Set(out)];
};

/* ---------- profiles (who / which organization Auto selects) and searchable lists ---------- */
// Personal profiles of this computer win over the ones in the configuration.
const getProfiles = cfg => {
  try {
    const p = JSON.parse(localStorage.getItem('autoProfiles') || 'null');
    if (p && p.length) return p;
  } catch (_) {}
  return (cfg.opts && cfg.opts.profiles) || [];
};
const profileText = p => p.name + (p.org ? ' / ' + p.org : '');

// A real-looking click (mousedown, mouseup, click): frameworks often ignore a bare click().
const fireClick = el => {
  const W = winOf(el);
  ['mousedown', 'mouseup', 'click'].forEach(t => el.dispatchEvent(new W.MouseEvent(t, { bubbles: true, cancelable: true, view: W })));
};

// The row an option belongs to (its text may be spread over several cells).
const rowOf = el => el.closest('tr,li,[role=option],[role=row]') || el;

// A selector that matches every option of a list, built from one example option: tag, role, stable classes.
const optSelector = el => {
  const cls = [...el.classList].filter(c => !/\d/.test(c) && c.length < 30).slice(0, 2);
  const role = el.getAttribute('role');
  return el.tagName.toLowerCase() + (role ? '[role="' + role + '"]' : '') + cls.map(c => '.' + CSS.escape(c)).join('');
};

// Who is selected (and in which organization). Several profiles: ask which one, remember the answer.
const chooseProfile = cfg => {
  let list = getProfiles(cfg);
  if (!list.length) {
    const n = (prompt('Your name, i.e. the option to select in the person list (exactly as shown). It is remembered on this computer:') || '').trim();
    if (!n) throw new Error('No name given.');
    const g = (prompt('Organization to select (leave empty if not needed):') || '').trim();
    list = [{ name: n, org: g }];
    localStorage.setItem('autoProfiles', JSON.stringify(list));
  }
  if (list.length === 1) return list[0];
  const last = parseInt(localStorage.getItem('autoProfileIdx') || '0', 10);
  const n = parseInt(prompt('Which profile?\n' + list.map((p, i) => (i + 1) + '. ' + profileText(p)).join('\n') + '\n\nNumber:', String(Math.min(last, list.length - 1) + 1)), 10);
  if (!(n >= 1 && n <= list.length)) throw new Error('No profile chosen.');
  localStorage.setItem('autoProfileIdx', String(n - 1));
  return list[n - 1];
};

/* ---------- recorded steps (Record / Play) ---------- */
const SAVE_RE = /^(save|zapisz|zatwierd[zź]\w*|submit)$/i;
const modeText = m => ({ only: ' (the only row)', 'profile.name': ' (your name)', 'profile.org': ' (your organization)' }[m] || '');

// A one-line description of a recorded step.
const say = a => {
  const l = a.loc ? a.loc.label : '', w = a.win ? ' [new tab]' : '';
  if (a.t === 'click') return 'click ' + (a.text ? '"' + a.text + '"' : '[' + l + ']') + w;
  if (a.t === 'row') return 'choose the list row' + (a.text ? ' "' + short(a.text) + '"' : '') + modeText(a.mode) + w;
  if (a.t === 'select') return 'choose' + (a.text ? ' "' + a.text + '"' : '') + ' in "' + l + '"' + modeText(a.mode) + w;
  const what = a.src === 'scan' ? 'the scanned code' : a.src === 'copy' ? 'a copy of "' + a.from.label + '"'
    : a.src === 'profile.name' ? 'your name' : a.src === 'profile.org' ? 'your organization' : '"' + short(a.value || '') + '"';
  return 'type ' + what + ' into "' + l + '"' + w;
};
