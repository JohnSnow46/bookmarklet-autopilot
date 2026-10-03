// Record: do the process once, normally. Every click, typed value and choice is recorded; Play repeats it.
const RK = 'autoRec';
const CLICKABLE = 'button,a,input,select,textarea,[role=button],[role=option],[role=menuitem],summary,li,tr,td';
const win = window.opener ? 1 : 0; // 1 = this is the new tab opened by the page

const prevCfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
let rec = JSON.parse(localStorage.getItem(RK) || 'null');
if (rec && rec.actions && rec.actions.length && !rec.done) {
  if (!confirm('Continue the recording (' + rec.actions.length + ' steps so far)? Cancel = start a new one')) rec = null;
} else if (rec && rec.done && !win) {
  if (!confirm('A recording already exists. Record again?')) return;
  rec = null;
}
if (!rec || !rec.actions) rec = { actions: [], done: false };
const A = rec.actions;
const save = () => localStorage.setItem(RK, JSON.stringify(rec));

const b = makeBar('__record');
let off = null, notice = '';

const textLike = el => {
  const t = el.tagName.toLowerCase();
  return t === 'textarea' || (t === 'input' && !/^(button|submit|reset|image|checkbox|radio|file|password|hidden)$/.test(el.type));
};
const buttonLike = el => {
  const t = el.tagName.toLowerCase();
  return t === 'button' || (t === 'input' && /^(button|submit|reset|image)$/.test(el.type)) || el.getAttribute('role') === 'button';
};
const where = el => ({ ...describe(el), label: labelOf(el) });
const sameLoc = (x, y) => x.sel === y.sel && String(x.frame) === String(y.frame);

// Another field that already shows exactly this text: the value was copied from there.
const copySource = (el, v) => {
  if (v.trim().length < 3) return null;
  for (const d of allDocs()) {
    for (const o of d.querySelectorAll('input,textarea')) {
      if (o !== el && textLike(o) && norm(o.value) === norm(v)) return o;
    }
  }
  return null;
};

const add = a => { A.push(a); save(); draw(); };

const onClick = e => {
  if (!e.isTrusted || b.contains(e.target) || !e.target.closest) return; // real clicks only
  const raw = e.target;
  const el = raw.closest(CLICKABLE) || raw;
  const tag = el.tagName.toLowerCase();
  if (textLike(el) || tag === 'select' || tag === 'option' || tag === 'label' || tag === 'html' || tag === 'body') return;
  const a = { t: 'click', win, loc: where(el) };
  const row = rowOf(el);
  if (!buttonLike(el) && row.parentElement && (row !== el || el.matches('li,[role=option],tr'))) {
    // a row of a list or a table: Play finds it again by its text, not by its position
    Object.assign(a, { t: 'row', match: optSelector(el), text: norm(row.textContent).slice(0, 120), box: describe(row.parentElement), mode: 'fixed' });
  } else if (buttonLike(el)) {
    a.text = norm(el.textContent || el.value || '').slice(0, 60);
  }
  add(a);
};

const onChange = e => {
  const el = e.target;
  if (!el || !el.tagName || b.contains(el)) return;
  if (el.type === 'password') { notice = 'A password field was not recorded: type it yourself when Play stops there.'; draw(); return; }
  const tag = el.tagName.toLowerCase();
  if (tag === 'select') {
    const o = el.options[el.selectedIndex];
    return add({ t: 'select', win, loc: where(el), text: o ? o.text.trim() : '', mode: 'fixed' });
  }
  if (!textLike(el)) return;
  const a = { t: 'set', win, loc: where(el), value: el.value };
  if (!A.length && !win) { a.src = 'scan'; rec.scan = el.value; }
  else {
    const o = copySource(el, el.value);
    if (o) { a.src = 'copy'; a.from = where(o); delete a.value; }
  }
  const last = A[A.length - 1];
  if (last && last.t === 'set' && last.win === win && sameLoc(last.loc, a.loc)) { A[A.length - 1] = a; save(); draw(); } else add(a);
};

const quit = () => { if (off) off(); b.remove(); };

// What the user is asked after pressing "Stop": remove steps, say what changes between runs, what to confirm.
const review = () => {
  if (!A.length) { alert('Nothing was recorded.'); return; }
  const list = () => A.map((a, i) => (i + 1) + '. ' + say(a)).join('\n');
  const rm = prompt('Recorded ' + A.length + ' steps:\n' + list() + '\n\nNumbers of steps to REMOVE (comma separated), or leave empty to keep all:', '');
  if (rm === null) return;
  const drop = new Set(rm.split(',').map(x => parseInt(x, 10) - 1));
  const steps = A.filter((_, i) => !drop.has(i));

  // lists: what is chosen is fixed, the only row, your name or your organization
  let usesProfile = false;
  steps.forEach((a, i) => {
    if (a.t !== 'row' && a.t !== 'select') return;
    const text = a.text, isRow = a.t === 'row';
    const guess = isRow && rec.scan && norm(text, true).includes(norm(rec.scan, true)) ? '2' : '1';
    const ans = prompt('Step ' + (i + 1) + ': you ' + (isRow ? 'picked the list row "' + short(text) + '"' : 'chose "' + text + '" in the drop-down "' + a.loc.label + '"')
      + '.\n\n1 = always this one\n' + (isRow ? '2 = the only row that is shown (it changes with every scan)\n' : '')
      + '3 = your name (what differs between people)\n4 = your organization\n\nNumber (empty = ' + guess + '):', guess);
    if (ans === null) return;
    // an empty answer accepts the suggestion
    a.mode = { 1: 'fixed', 2: 'only', 3: 'profile.name', 4: 'profile.org' }[ans.trim() || guess] || 'fixed';
    if (a.t === 'select' && a.mode === 'only') a.mode = 'fixed';
    if (a.mode.startsWith('profile')) {
      usesProfile = true;
      const prev = steps[i - 1]; // the text typed into the search box of that list follows the profile, too
      if (prev && prev.t === 'set' && prev.win === a.win && !prev.src) { prev.src = a.mode; delete prev.value; }
    }
  });
  // data that changes between runs is not kept (product names, people): only a fixed choice stays in the recording
  steps.forEach(a => { if ((a.t === 'row' || a.t === 'select') && a.mode !== 'fixed') a.text = ''; });
  const profiles = [];
  if (usesProfile) {
    const o = ((prevCfg && prevCfg.opts) || {}).profiles || [];
    const n = prompt('Your name as it appears in the lists (a part that is unique is enough):', (o[0] || {}).name || '');
    if (n === null) return;
    if (!n.trim() && !(o[0] || {}).name) { alert('The name cannot be empty.'); return; }
    const g = prompt('Your organization (leave empty if none):', (o[0] || {}).org || '');
    if (g === null) return;
    profiles.push({ name: n.trim() || o[0].name, org: (g || '').trim() });
  }

  // steps that need a confirmation first: the ones that look like Save
  const dflt = steps.map((a, i) => (a.t === 'click' && SAVE_RE.test(a.text || '') ? i + 1 : 0)).filter(Boolean).join(',');
  const ask = prompt('Ask "Save?" before which steps? Step numbers, comma separated. 0 = never, empty = the suggestion:\n' + steps.map((a, i) => (i + 1) + '. ' + say(a)).join('\n'), dflt);
  if (ask === null) return;
  const askAt = new Set((ask.trim() || dflt).split(',').map(x => parseInt(x, 10) - 1)); // 0 gives -1: never
  steps.forEach((a, i) => { if (askAt.has(i)) a.confirm = true; else delete a.confirm; });
  steps.forEach(a => { if (a.src === 'scan') delete a.value; });

  if (!confirm('Save this recording?\n' + steps.map((a, i) => (i + 1) + '. ' + say(a) + (a.confirm ? '   [asks "Save?"]' : '')).join('\n'))) return;
  localStorage.setItem('autoCfg', JSON.stringify({
    v: 4,
    macro: steps,
    opts: { profiles, confirmSave: true },
    rules: (prevCfg && prevCfg.v === 4 && prevCfg.rules) || [],
  }));
  rec.done = true;
  rec.actions = []; // the raw recording (typed values, row texts) does not stay behind
  save();
  if (off) off();
  b.style.background = 'rgb(46,125,50)';
  b.innerHTML = '<b>Done!</b> ' + steps.length + ' steps saved. Scan a code and use Play.';
  setTimeout(() => b.remove(), 6000);
};

const draw = () => {
  b.innerHTML = '<b>' + String.fromCharCode(9679) + ' Recording' + (win ? ' (new tab)' : '') + ':</b> ' + A.length + ' step(s). Do the process normally; use Stop when you are done.';
  b.style.background = 'rgb(179,38,30)';
  if (notice) b.appendChild(document.createTextNode(' ' + notice));
  barButton(b, 'Stop and review', review);
  barButton(b, 'Undo last', () => { A.pop(); save(); draw(); });
  barButton(b, 'Cancel recording', () => { localStorage.removeItem(RK); quit(); });
};

off = hookPicker(e => (e.type === 'click' ? onClick(e) : onChange(e)), ['click', 'change']);
save();
draw();
