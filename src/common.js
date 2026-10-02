// Shared helpers. The build prepends this file to every script (one shared scope).
const H = /*@__PURE__*/String.fromCharCode(35); // the hash character without typing it in the source
const TXT = ['searchBtn', 'save', 'gen', 'print', 'apply']; // steps that are also recognised by their button text

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

// Sets the value with the native setter and fires the events the framework listens to.
const setVal = (el, v) => {
  const p = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

// Finds the visible, enabled element stored under key k (null if it is not there).
const find = (cfg, k, d = document) => {
  const c = cfg[k];
  if (!c || c.skipped) throw new Error('Missing in configuration: ' + k);
  // main selector first, then the fallback built from stable attributes
  const el = d.querySelector(c.sel) || (c.alt && d.querySelector(c.alt));
  if (!el || el.disabled || el.offsetParent === null) return null;
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
