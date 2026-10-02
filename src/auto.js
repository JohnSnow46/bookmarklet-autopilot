const cfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
if (!cfg) { alert('Run the Learn bookmarklet first.'); return; }
if (cfg.v !== 2) { alert('The configuration is in an old format. Run Learn again.'); return; }
const S = cfg.steps, C = cfg.opts;

const fnd = (k, d) => find(S, k, d);
const need = k => {
  const e = fnd(k);
  if (!e) throw new Error('Cannot see element: ' + k);
  return e;
};

(async () => {
  try {
    const s = fnd('search');
    if (!s || !s.value.trim()) throw new Error('Scan a code into the search field first.');
    (await waitFor(() => fnd('searchBtn'), 'Search button')).click();
    (await waitFor(() => fnd('result'), 'search result')).click();
    const l1 = await waitFor(() => fnd('line1'), 'form');
    setVal(need('line2'), l1.value);
    setVal(need('line3'), C.extraLine);
    if (!S.user.skipped) {
      const sel = need('user');
      const o = [...sel.options].find(x => x.text.trim() === C.userOption);
      if (!o) throw new Error('No such option in the list: ' + C.userOption);
      setVal(sel, o.value);
    }
    if (C.confirmSave && !confirm('Save?')) return;
    need('save').click();
    (await waitFor(() => fnd('gen'), 'Generate button')).click();
    const pb = await waitFor(() => fnd('print'), 'Print button', 30000);
    const oo = window.open;
    window.open = function (...a) {
      window.open = oo;
      const w = oo.apply(window, a);
      if (!w) { alert('The browser blocked the new tab. Allow pop-ups for this site.'); return w; }
      waitFor(() => fnd('apply', w.document), 'Apply in the new tab', 30000)
        .then(x => x.click())
        .catch(e => alert('Print tab: ' + e.message));
      return w;
    };
    pb.click();
  } catch (e) { alert('Auto: ' + e.message); }
})();
