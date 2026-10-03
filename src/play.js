// Play: repeats the recorded steps. EMBED is defined only by an exported bookmarklet (Export).
const cfg = typeof EMBED !== 'undefined' ? JSON.parse(dec(EMBED)) : JSON.parse(localStorage.getItem('autoCfg') || 'null');
if (!cfg || cfg.v !== 4 || !cfg.macro) { alert('Nothing recorded yet. Use the Record bookmarklet first.'); return; }
const M = cfg.macro, O = cfg.opts || {}, R = cfg.rules || [];

// The page may reload in the middle (and this script with it): clicking Play again continues for 60 seconds.
const PK = 'playState';
const readState = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(PK) || 'null');
    return s && s.n === M.length && Date.now() - s.t < 60000 ? s : null;
  } catch (_) { return null; }
};
const writeState = (i, p) => sessionStorage.setItem(PK, JSON.stringify({ i, n: M.length, t: Date.now(), p }));
const clearState = () => sessionStorage.removeItem(PK);

(async () => {
  const wins = {}; // wins[1] = the new tab opened by the page
  const oo = window.open;
  let i = 0, stage = 'start', watch = null; // watch: error texts that were already on screen before Save
  try {
    const st = readState();
    if (st) i = st.i;
    const needsProfile = M.some(a => /^profile/.test(a.src || a.mode || ''));
    const profile = needsProfile ? (st && st.p) || chooseProfile(cfg) : null;
    window.open = function (...a) {
      window.open = oo;
      const w = oo.apply(window, a);
      if (!w) alert('The browser blocked the new tab. Allow pop-ups for this site.'); else wins[1] = w;
      return w;
    };

    for (; i < M.length; i++) {
      const a = M[i];
      stage = 'step ' + (i + 1) + ' (' + say(a) + ')';
      writeState(i, profile); // an interrupted step is retried; a click that went through is not repeated (see below)
      const root = () => (a.win ? wins[1] && wins[1].document : document);
      const wait = (fn, what, t = 30000) => waitForOr(() => { const d = root(); return d ? fn(d) : null; },
        () => (watch ? errorTexts().find(x => !watch.includes(x)) : null), what, t);
      const known = errorTexts();
      const text = (v, p) => (v === 'profile.name' ? p.name : v === 'profile.org' ? p.org : '');

      if (a.t === 'click') {
        const el = await wait(d => {
          const e = locate(a.loc, d);
          return e && !e.disabled && shown(e) && (!a.text || norm(e.textContent || e.value || '') === a.text) ? e : null;
        }, a.text ? '"' + a.text + '"' : '[' + a.loc.label + ']');
        if (a.confirm) {
          const f = runRules(R, 'beforeSave', root());
          if (f.length) throw new Error('Validation failed, nothing was saved.\n' + f.join('\n'));
          if (O.confirmSave !== false && !confirm('Save?')) { clearState(); return; }
        }
        watch = null;
        ['mousedown', 'mouseup'].forEach(t => el.dispatchEvent(new (winOf(el).MouseEvent)(t, { bubbles: true, cancelable: true, view: winOf(el) })));
        el.click();
        writeState(i + 1, profile); // the click may reload the page: continue after it
        watch = a.confirm ? known : null; // from here on an application error stops the run
      } else if (a.t === 'row') {
        watch = null;
        const want = a.mode === 'fixed' ? norm(a.text, true) : a.mode === 'only' ? '' : norm(text(a.mode, profile), true);
        const more = a.mode === 'profile.name' && profile.org ? norm(profile.org, true) : '';
        const rows = d => {
          const box = locate(a.box, d);
          if (!box) return [];
          const found = new Map();
          box.querySelectorAll(a.match).forEach(el => {
            const row = rowOf(el), t = norm(row.textContent, true);
            if (shown(el) && t.includes(want) && !found.has(row)) found.set(row, el);
          });
          const all = [...found], narrowed = all.filter(([r]) => norm(r.textContent, true).includes(more));
          return narrowed.length ? narrowed : all;
        };
        let last = -1, steady = 0, now = [];
        await wait(d => {
          now = rows(d);
          steady = now.length && now.length === last ? steady + 1 : 0; // wait until the list stops changing
          last = now.length;
          return steady >= 2;
        }, 'the list row "' + short(a.text) + '"', 20000);
        if (now.length > 1) {
          throw new Error('More than one row matches:\n' + now.map(([r], k) => (k + 1) + ') ' + norm(r.textContent)).join('\n')
            + '\nNothing was selected. Choose by hand, or add your organization to the profile (Show).');
        }
        const el = now[0][1];
        ['mousedown', 'mouseup'].forEach(t => el.dispatchEvent(new (winOf(el).MouseEvent)(t, { bubbles: true, cancelable: true, view: winOf(el) })));
        el.click();
        writeState(i + 1, profile);
        await sleep(300);
      } else if (a.t === 'select') {
        const el = await wait(d => { const e = locate(a.loc, d); return e && !e.disabled && shown(e) ? e : null; }, '"' + a.loc.label + '"');
        watch = null;
        const name = a.mode.startsWith('profile') ? text(a.mode, profile) : a.text;
        const opts = [...el.options];
        const o = opts.find(x => x.text.trim() === name) || opts.filter(x => norm(x.text, true).includes(norm(name, true)) && x.value)[0];
        if (!name || !o) throw new Error('No such option in the list "' + a.loc.label + '": ' + name);
        setVal(el, o.value);
        if (norm(readVal(el)) !== norm(o.text)) throw new Error('The list "' + a.loc.label + '" did not keep the choice: it shows "' + readVal(el) + '".');
      } else { // set
        const el = await wait(d => { const e = locate(a.loc, d); return e && !e.disabled && shown(e) ? e : null; }, '"' + a.loc.label + '"');
        watch = null;
        if (a.src === 'scan') {
          if (!el.value.trim()) throw new Error('Scan a code into "' + a.loc.label + '" first.');
        } else {
          let v = a.value;
          if (a.src === 'copy') {
            const from = await wait(d => locate(a.from, d), '"' + a.from.label + '"');
            v = readVal(from);
          } else if (a.src) v = text(a.src, profile);
          if (v === undefined || (a.src && !v.trim())) throw new Error('There is nothing to type into "' + a.loc.label + '".');
          setVal(el, v);
          if (norm(readVal(el)) !== norm(v)) throw new Error('The field "' + a.loc.label + '" did not keep the value: it shows "' + short(readVal(el)) + '" instead of "' + short(v) + '".');
        }
      }
    }
    clearState();
  } catch (e) {
    clearState();
    alert('Play stopped at ' + stage + ':\n' + e.message);
  } finally {
    if (window.open !== oo && !wins[1]) window.open = oo;
  }
})();
