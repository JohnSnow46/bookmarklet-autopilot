// EMBED is defined only by an exported bookmarklet (Export): then the configuration is built in.
const cfg = typeof EMBED !== 'undefined' ? JSON.parse(dec(EMBED)) : JSON.parse(localStorage.getItem('autoCfg') || 'null');
if (!cfg || !cfg.steps || !cfg.steps.search) { alert('Run the Learn bookmarklet first.'); return; }
if (cfg.v !== 3) { alert('The configuration is in an old format. Run Learn again.'); return; }
const S = cfg.steps, C = cfg.opts || {}, R = cfg.rules || [];
const on = k => !!S[k] && !S[k].skipped;
const hasUser = on('user'), hasPerson = on('personOpen'), hasOrg = on('orgOpen');

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

// Who Auto selects (and in which organization). Several profiles: ask which one, remember the answer.
const chooseProfile = () => {
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

// Selects text in a searchable list: open it, search, wait for the rows, click the one row that matches.
// extra (e.g. the organization) must also occur in the row; with soft it only narrows the choice when rows show it.
// Several matching rows are never guessed.
const pickFromList = async (g, text, extra, label, soft) => {
  const open = need(g + 'Open');
  fireClick(open);
  const box = on(g + 'Search') ? await waitFor(() => fnd(g + 'Search'), label + ' search field') : open;
  setVal(box, text);
  const W = winOf(box);
  box.dispatchEvent(new W.KeyboardEvent('keyup', { bubbles: true, key: text.slice(-1) }));
  const want = norm(text, true), more = extra ? norm(extra, true) : '';
  const rows = () => {
    // rows near the search box (its list), else anywhere in the page and its frames
    let r = box.parentElement;
    while (r && !r.querySelector(S[g + 'Option'].match)) r = r.parentElement;
    const found = new Map();
    (r ? [r] : allDocs()).forEach(d => d.querySelectorAll(S[g + 'Option'].match).forEach(el => {
      const row = rowOf(el), t = norm(row.textContent, true);
      if (shown(el) && t.includes(want) && !found.has(row)) found.set(row, el);
    }));
    const all = [...found], narrowed = all.filter(([r]) => norm(r.textContent, true).includes(more));
    return narrowed.length || !soft ? narrowed : all;
  };
  const t0 = Date.now();
  let last = -1, steady = 0, enter = false, now = [];
  while (Date.now() - t0 < 15000) {
    now = rows();
    steady = now.length && now.length === last ? steady + 1 : 0; // wait until the list stops changing
    last = now.length;
    if (steady >= 2) break;
    if (!enter && !now.length && Date.now() - t0 > 3000) { // lists that search on Enter
      enter = true;
      ['keydown', 'keypress', 'keyup'].forEach(t => box.dispatchEvent(new W.KeyboardEvent(t, { bubbles: true, key: 'Enter', keyCode: 13 })));
    }
    await sleep(150);
  }
  if (!now.length) throw new Error('No row containing "' + text + '"' + (extra ? ' and "' + extra + '"' : '') + ' appeared in the ' + label + ' list.');
  if (now.length > 1) {
    throw new Error('More than one row of the ' + label + ' list matches "' + text + '"' + (extra ? ' / "' + extra + '"' : '') + ':\n'
      + now.map(([r], i) => (i + 1) + ') ' + norm(r.textContent)).join('\n') + '\nNothing was selected. Choose by hand, or add the organization to the profile (Show).');
  }
  fireClick(now[0][1]);
  await sleep(300);
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
      const profile = hasUser || hasPerson || hasOrg ? chooseProfile() : null;
      if (hasUser) {
        const sel = need('user');
        const o = [...sel.options].find(x => x.text.trim() === profile.name);
        if (!o) throw new Error('No such option in the list: ' + profile.name);
        setVal(sel, o.value);
      }
      if (hasPerson) { stage = 'person list'; await pickFromList('person', profile.name, profile.org, 'person', hasOrg); }
      if (hasOrg && profile.org) { stage = 'organization list'; await pickFromList('org', profile.org, '', 'organization', false); }
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
