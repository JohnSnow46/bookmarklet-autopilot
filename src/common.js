// Wspólne narzędzia. Build dokleja ten plik przed każdym skryptem (wszystko w jednym zasięgu).
const H = /*@__PURE__*/String.fromCharCode(35); // znak kratki bez wpisywania go w kodzie
const TXT = ['searchBtn', 'save', 'gen', 'print', 'apply']; // kroki rozpoznawane także po tekście przycisku

const sleep = ms => new Promise(r => setTimeout(r, ms));

const waitFor = async (fn, what, t = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < t) {
    let r = null;
    try { r = fn(); } catch (_) {}
    if (r) return r;
    await sleep(150);
  }
  throw new Error('Nie pojawił się element: ' + what);
};

// Ustawia wartość natywnym setterem i wysyła zdarzenia, które widzi framework.
const setVal = (el, v) => {
  const p = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

// Znajduje widoczny, aktywny element zapamiętany pod kluczem k (null, jeśli go nie ma).
const find = (cfg, k, d = document) => {
  const c = cfg[k];
  if (!c) throw new Error('Brak w konfiguracji: ' + k);
  const el = d.querySelector(c.sel);
  if (!el || el.disabled || el.offsetParent === null) return null;
  if (TXT.includes(k) && c.text && el.textContent.trim() !== c.text) return null;
  return el;
};

// base64 z obsługą UTF-8
const enc = s => btoa(unescape(encodeURIComponent(s)));
const dec = b => decodeURIComponent(escape(atob(b)));

// Selektor CSS elementu: od najbliższego id w górę, dalej :nth-of-type.
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
