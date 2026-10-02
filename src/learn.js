// Learning steps. type: input | button | select | link | any, optional: can be skipped.
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
  { key: 'error', desc: 'an error message of the application (only if one is on screen now, otherwise Skip)', type: 'any', optional: true },
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

const b = makeBar('__learn');
const store = () => localStorage.setItem(K, JSON.stringify(st));

// Everything suspicious about the picked element; the user is asked to confirm when this is not empty.
const warnings = (el, key, type, sel, frame) => {
  const w = [];
  const kind = kindOf(el);
  if (!kindOk(kind, type)) w.push('This looks like ' + (kind === 'other' ? 'something else' : 'a ' + kind) + ', but this step expects ' + (type === 'input' ? 'an input' : 'a ' + type) + '. Steps may be shifted by one.');
  for (const [k, c] of Object.entries(st.steps)) {
    if (c.sel === sel && String(c.frame) === String(frame) && ![key, k].every(x => x === 'gen' || x === 'print')) {
      w.push('The same element was already picked for the "' + k + '" step.');
    }
  }
  let n = 0;
  try { n = [...el.ownerDocument.querySelectorAll(sel)].filter(shown).length; } catch (_) {}
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
  const s = STEPS[st.i], key = s.key, loc = describe(el);
  const w = warnings(el, key, s.type, loc.sel, loc.frame);
  if (w.length && !confirm('Warning for ' + s.desc + ':\n- ' + w.join('\n- ') + '\n\nAre you sure?')) return;
  // Store the visible text only where Auto needs it (button captions), never e.g. a product name.
  st.steps[key] = { ...loc, label: labelOf(el), text: TXT.includes(key) ? el.textContent.trim() : '' };
  el.style.outline = '3px solid rgb(46,125,50)';
  setTimeout(() => { el.style.outline = ''; }, 800);
  st.i++;
  store();
  draw();
};

let off = hookPicker(pick);

const back = () => {
  if (st.i > 0) { st.i--; delete st.steps[STEPS[st.i].key]; store(); draw(); }
};

// Rules every configuration starts with: the pasted line equals the copied one, the append is not empty,
// a list value is chosen. Rules added later with Validate are kept when learning again.
const defaultRules = steps => {
  const loc = (k, label) => ({ frame: steps[k].frame, sel: steps[k].sel, alt: steps[k].alt, label });
  const rules = [
    { type: 'equal', a: loc('line1', 'line1'), b: loc('line2', 'line2'), when: 'beforeSave', ci: false, def: true },
    { type: 'notEmpty', a: loc('line3', 'line3'), when: 'beforeSave', ci: false, def: true },
  ];
  if (!steps.user.skipped) rules.push({ type: 'notEmpty', a: loc('user', 'user'), when: 'beforeSave', ci: false, def: true });
  return rules.concat(((prevCfg && prevCfg.rules) || []).filter(r => !r.def));
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
  const rules = defaultRules(st.steps);
  const lines = STEPS.map((s, i) => {
    const c = st.steps[s.key];
    return (i + 1) + '. ' + s.key + ' - ' + (c.skipped ? 'skipped' : c.tag + (c.text ? ' "' + c.text + '"' : '') + (c.alt ? ' (+ fallback)' : ''));
  });
  if (!confirm('Check the configuration:\n' + lines.join('\n') + '\n\nAppend text: "' + extra + '"' + (userOption ? '\nList option: "' + userOption + '"' : '')
    + '\n\nValidation rules:\n' + rules.map(ruleText).join('\n') + '\n\nSave it?')) return;
  const confirmSave = confirm('Ask "Save?" before every Save? (OK = yes, Cancel = no)');
  localStorage.setItem('autoCfg', JSON.stringify({
    v: 3,
    steps: st.steps,
    opts: { extraLine: extra, userOption, confirmSave },
    rules,
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
    barButton(b, 'Save settings', finish);
    barButton(b, 'Back', back);
    return;
  }
  const s = STEPS[st.i];
  b.innerHTML = '<b>Learn ' + (st.i + 1) + '/' + STEPS.length + ':</b> Ctrl+click on: <u>' + s.desc + '</u>'
    + (s.optional ? ' (optional)' : '') + ' (a plain click works normally)';
  if (s.optional) barButton(b, 'Skip', () => { st.steps[s.key] = { skipped: true }; st.i++; store(); draw(); });
  barButton(b, 'Back', back);
  barButton(b, 'Quit', () => { off(); b.remove(); });
};

draw();
