// Record: do the process once, normally. Every click, typed value and choice is recorded; Play repeats it.
const RK = 'autoRec';
const CLICKABLE = 'button,a,input,select,textarea,[role=button],[role=option],[role=menuitem],summary,li,tr,td';

let prevCfg;
try { prevCfg = loadCfg(); } catch (e) {
  if (/newer version/.test(e.message)) { alert(e.message); return; } // never overwrite what a newer version made
  prevCfg = null; // a damaged configuration is replaced by the new recording
}
// Play (or Auto) working on this page, or on the page that opened this tab (it types here, too)
const busy = () => { try { return window.__autopilotRun || (window.opener && window.opener.__autopilotRun); } catch (e) { return ''; } };
if (busy()) { alert(busy() + ' is running on this page: wait for it to finish, then record.'); return; }
let rec = getJSON(RK);
if (!store()) { alert('The browser blocks storage on this page, so nothing can be recorded here.'); return; }
if (rec && !Array.isArray(rec.actions)) rec = null; // a damaged recording in progress: start a new one
const ok = a => a && typeof a === 'object' && typeof a.t === 'string' && a.loc;
if (rec) rec.actions = rec.actions.filter(ok); // and drop damaged steps
// The tab where a recording starts keeps its id (RT, per tab). A tab whose opener is that tab is the new tab the
// routine opened (steps there are marked win 1); any other tab, e.g. a window a portal opened, starts on its own.
const RT = 'autoRecTab';
const openedByRecording = r => { try { return !!window.opener && JSON.parse(window.opener.sessionStorage.getItem(RT)) === r.id; } catch (e) { return false; } };
const win = rec && !rec.done && rec.id && openedByRecording(rec) ? 1 : 0; // 1 = the new tab opened during the recording
if (win) {
  // it joins the recording of the tab that opened it: nothing to ask, and nothing of that tab is overwritten
} else if (rec && rec.actions.length && !rec.done) {
  if (!confirm('Continue the recording (' + rec.actions.length + ' steps so far)? Cancel = start a new one')) rec = null;
  else { const r = getJSON(RK); if (r && Array.isArray(r.actions) && !r.done) rec = { ...r, actions: r.actions.filter(ok) }; } // steps another tab added meanwhile
} else if (rec && rec.done) {
  if (!confirm('A recording already exists. Record again?')) return;
  rec = null;
}
if (!rec || !Array.isArray(rec.actions) || rec.done) rec = { actions: [], done: false };
if (!rec.id) rec.id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
if (!win) setJSON(RT, rec.id, true);
else drop(RT, true); // the copy of the opener's id: a tab that this one opens is not the recording's new tab
const save = () => setJSON(RK, rec);
// The page and the new tab it opened record into the same storage: always go on from what is stored there.
// false when the recording was finished (or cancelled) in the other tab, or another one was started there.
const sync = () => {
  const r = getJSON(RK);
  if (!r || r.done || (r.id && r.id !== rec.id)) return false;
  if (Array.isArray(r.actions)) rec.actions = r.actions;
  if (r.scan) rec.scan = r.scan;
  return true;
};

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

const add = a => { if (!sync()) return elsewhere(); rec.actions.push(a); save(); draw(); };

const onClick = e => {
  if (!e.isTrusted || b.contains(e.target) || !e.target.closest) return; // real clicks only
  const raw = e.target;
  const el = raw.closest(CLICKABLE) || raw;
  const tag = el.tagName.toLowerCase();
  if (textLike(el) || tag === 'select' || tag === 'option' || tag === 'label' || tag === 'html' || tag === 'body') return;
  const a = { t: 'click', win, loc: where(el) };
  // the Save-like word of a link or button caption (e.g. "Delete"), kept without the rest of the text (names, numbers)
  const m = el.matches('a,button,[role=button]') && norm(el.textContent || el.value || '').match(SAVE_LIKE);
  const cap = m ? m[2].toLowerCase() : '';
  const row = rowOf(el);
  if (!buttonLike(el) && row.parentElement && (row !== el || el.matches('li,[role=option],tr'))) {
    // a row of a list or a table: Play finds it again by its text, not by its position
    Object.assign(a, { t: 'row', match: optSelector(el), text: norm(row.textContent).slice(0, 120), box: describe(row.parentElement), mode: 'fixed' });
    if (cap) a.cap = cap;
  } else if (tag === 'a' && !buttonLike(el)) {
    if (cap) a.cap = cap; // a link can save or delete, too
  } else if (buttonLike(el)) {
    a.text = norm(el.textContent || el.value || '').slice(0, 60);
  }
  add(a);
};

const onChange = e => {
  const el = e.target;
  // while Play (or Auto) works on this page, the changes are its own, not something the user did
  if (busy() || !el || !el.tagName || b.contains(el)) return;
  if (el.type === 'password') { notice = 'A password field was not recorded: type it yourself when Play stops there.'; draw(); return; }
  const tag = el.tagName.toLowerCase();
  if (tag === 'select') {
    const o = el.options[el.selectedIndex];
    return add({ t: 'select', win, loc: where(el), text: o ? o.text.trim() : '', mode: 'fixed' });
  }
  if (!textLike(el)) return;
  const a = { t: 'set', win, loc: where(el), value: el.value };
  if (!sync()) return elsewhere();
  const A = rec.actions;
  if (!A.length && !win) { a.src = 'scan'; rec.scan = el.value; }
  else {
    const o = copySource(el, el.value);
    if (o) { a.src = 'copy'; a.from = where(o); delete a.value; }
  }
  const last = A[A.length - 1];
  if (last && last.t === 'set' && last.win === win && sameLoc(last.loc, a.loc)) { A[A.length - 1] = a; save(); draw(); } else add(a);
};

let watcher = 0;
const quit = () => { if (off) off(); clearInterval(watcher); b.remove(); };
// Stopped or cancelled in the other tab: this bar must not go on recording.
const elsewhere = () => {
  if (off) off();
  off = null;
  clearInterval(watcher);
  b.style.background = 'rgb(90,90,90)';
  b.textContent = 'The recording was finished, cancelled or started again in another tab. Nothing more is recorded here.';
  setTimeout(() => b.remove(), 6000);
};

// What the user is asked after pressing "Stop": remove steps, say what changes between runs, what to confirm.
const review = () => {
  if (!sync()) return elsewhere();
  const A = rec.actions;
  if (!A.length) { alert('Nothing was recorded.'); return; }
  const list = () => A.map((a, i) => (i + 1) + '. ' + say(a)).join('\n');
  const rm = prompt('Recorded ' + A.length + ' steps:\n' + list() + '\n\nNumbers of steps to REMOVE (comma separated), or leave empty to keep all:', '');
  if (rm === null) return;
  const removed = new Set(rm.split(',').map(x => parseInt(x, 10) - 1));
  const steps = A.filter((_, i) => !removed.has(i));

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
  const dflt = steps.map((a, i) => ((a.t === 'click' || a.t === 'row') && SAVE_RE.test((a.t === 'click' && a.text) || a.cap || '') ? i + 1 : 0)).filter(Boolean).join(',');
  const ask = prompt('Ask "Save?" before which steps? Step numbers, comma separated. 0 = never, empty = the suggestion:\n' + steps.map((a, i) => (i + 1) + '. ' + say(a)).join('\n'), dflt);
  if (ask === null) return;
  const askAt = new Set((ask.trim() || dflt).split(',').map(x => parseInt(x, 10) - 1)); // 0 gives -1: never
  steps.forEach((a, i) => { if (askAt.has(i)) a.confirm = true; else delete a.confirm; });
  steps.forEach(a => { if (a.src === 'scan') delete a.value; });

  // Without a typed or scanned input, every run repeats exactly the same item.
  const noInput = steps.some(a => a.src === 'scan') ? '' : 'WARNING: no step types the input (a code), so Play will do exactly the same item every '
    + 'time. To fix it, record again and type or scan the code into the field yourself (do not pick it from a list of codes).\n\n';
  if (!confirm(noInput + 'Save this recording?\n' + steps.map((a, i) => (i + 1) + '. ' + say(a) + (a.confirm ? '   [asks "Save?"]' : '')).join('\n'))) return;
  if (!setJSON('autoCfg', {
    v: 4,
    macro: steps,
    opts: { profiles, confirmSave: true },
    rules: (prevCfg && prevCfg.v === 4 && prevCfg.rules) || [],
  })) { alert('The recording could not be stored: the browser storage is full or blocked.'); return; }
  rec.done = true;
  rec.actions = []; // the raw recording (typed values, row texts) does not stay behind
  delete rec.scan;
  save();
  if (off) off();
  clearInterval(watcher);
  b.style.background = 'rgb(46,125,50)';
  b.innerHTML = '<b>Done!</b> ' + steps.length + ' steps saved. Scan a code and use Play.';
  setTimeout(() => b.remove(), 6000);
};

const draw = () => {
  b.innerHTML = '<b>' + String.fromCharCode(9679) + ' Recording' + (win ? ' (new tab)' : '') + ':</b> ' + rec.actions.length + ' step(s). Do the process normally; use Stop when you are done.';
  b.style.background = 'rgb(179,38,30)';
  if (notice) b.appendChild(document.createTextNode(' ' + notice));
  barButton(b, 'Stop and review', review);
  barButton(b, 'Undo last', () => { if (!sync()) return elsewhere(); rec.actions.pop(); save(); draw(); });
  barButton(b, 'Cancel recording', () => {
    if (!confirm('Throw away the whole recording (' + rec.actions.length + ' steps)?')) return;
    drop(RK);
    quit();
  });
};

off = hookPicker(e => (e.type === 'click' ? onClick(e) : onChange(e)), ['click', 'change']);
save();
draw();
// keep the step count in step with the other tab, and notice when it finished the recording
let seen = rec.actions.length;
watcher = setInterval(() => {
  if (!sync()) return elsewhere();
  if (rec.actions.length !== seen) { seen = rec.actions.length; draw(); }
}, 1000);
