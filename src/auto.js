// EMBED is defined only by an exported bookmarklet (Export): then the configuration is built in.
const cfg = typeof EMBED !== 'undefined' ? JSON.parse(dec(EMBED)) : JSON.parse(localStorage.getItem('autoCfg') || 'null');
if (!cfg || !cfg.steps || !cfg.steps.search) { alert('Run the Learn bookmarklet first.'); return; }
if (cfg.v !== 3) { alert('The configuration is in an old format. Run Learn again.'); return; }
const S = cfg.steps, C = cfg.opts || {}, R = cfg.rules || [];
const hasUser = !!S.user && !S.user.skipped;

const fnd = (k, d) => (S[k] && !S[k].skipped ? find(S, k, d) : null);
const need = k => {
  const e = fnd(k);
  if (!e) throw new Error('Cannot see element: ' + k);
  return e;
};
const failRules = when => {
  const f = runRules(R, when);
  if (f.length) throw new Error('Validation failed, nothing was saved.\n' + f.join('\n'));
};

// The list option to choose: from the configuration, else asked once and remembered on this computer.
const listOption = () => {
  let o = C.userOption || localStorage.getItem('autoUserOption');
  if (!o) {
    o = (prompt('Name of the option to select in the User list (exactly as shown). It is remembered on this computer:') || '').trim();
    if (!o) throw new Error('No list option given.');
    localStorage.setItem('autoUserOption', o);
  }
  return o;
};

(async () => {
  let stage = 'start';
  try {
    // The page may be reloaded between steps (and this script with it): every run continues from what it sees.
    const inSaved = () => fnd('gen') || fnd('print');
    if (!inSaved()) {
      if (!fnd('line1')) {
        stage = 'search';
        if (!fnd('result')) {
          const s = need('search');
          if (!s.value.trim()) throw new Error('Scan a code into the search field first.');
          (await waitFor(() => fnd('searchBtn'), 'Search button')).click();
        }
        stage = 'open product';
        (await waitFor(() => fnd('result'), 'search result')).click();
        await waitFor(() => fnd('line1'), 'form');
      }
      stage = 'fill form';
      setVal(need('line2'), need('line1').value);
      setVal(need('line3'), C.extraLine);
      if (hasUser) {
        const sel = need('user');
        const name = listOption();
        const o = [...sel.options].find(x => x.text.trim() === name);
        if (!o) throw new Error('No such option in the list: ' + name);
        setVal(sel, o.value);
      }
      stage = 'validation before Save';
      failRules('beforeSave');
      stage = 'save';
      if (C.confirmSave && !confirm('Save?')) return;
      const known = errorTexts(S.error);
      need('save').click();
      stage = 'after Save';
      await waitForOr(() => inSaved(), () => errorTexts(S.error).find(t => !known.includes(t)), 'Generate button');
    }
    stage = 'validation before Generate';
    failRules('beforeGenerate');
    stage = 'generate';
    if (fnd('gen')) fnd('gen').click();
    stage = 'print';
    const pb = await waitFor(() => fnd('print'), 'Print button', 30000);
    const oo = window.open;
    window.open = function (...a) {
      window.open = oo;
      const w = oo.apply(window, a);
      if (!w) { alert('The browser blocked the new tab. Allow pop-ups for this site.'); return w; }
      waitFor(() => fnd('apply', w.document), 'Apply in the new tab', 30000)
        .then(x => x.click())
        .catch(e => alert('Auto stopped at "apply" (print tab): ' + e.message));
      return w;
    };
    pb.click();
  } catch (e) { alert('Auto stopped at "' + stage + '": ' + e.message); }
})();
