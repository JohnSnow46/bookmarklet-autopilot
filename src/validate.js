// Validate: build validation rules with Ctrl+click, stored in the configuration (autoCfg.rules).
const CK = 'autoCfg';
const cfg = JSON.parse(localStorage.getItem(CK) || 'null') || { v: 3, steps: {}, opts: {}, rules: [] };
if (cfg.v !== 3) { alert('The configuration is in an old format. Run Learn again.'); return; }
cfg.rules = cfg.rules || [];
const save = () => localStorage.setItem(CK, JSON.stringify(cfg));

const b = makeBar('__validate');
let off = null; // removes the active Ctrl+click handler

const stop = () => { if (off) { off(); off = null; } };
const quit = () => { stop(); b.remove(); };

// Waits for one Ctrl+click and passes the element to cb; a plain click works normally.
const waitPick = (msg, cb) => {
  stop();
  const h = e => {
    if (!e.ctrlKey || b.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type !== 'mousedown') return;
    const el = e.target.closest('button,a,input,select,textarea,[role=button]') || e.target;
    stop();
    el.style.outline = '3px solid rgb(46,125,50)';
    setTimeout(() => { el.style.outline = ''; }, 800);
    cb(el);
  };
  b.innerHTML = msg;
  barButton(b, 'Cancel', () => home());
  off = hookPicker(h);
};

const home = note => {
  stop();
  b.style.background = 'rgb(31,111,178)';
  b.innerHTML = '<b>Validate:</b> ' + cfg.rules.length + ' rule(s). ' + (note || '');
  barButton(b, 'Add rule', chooseType);
  barButton(b, 'Rules', listRules);
  barButton(b, 'Check now', checkNow);
  barButton(b, 'Quit', quit);
};

const chooseType = () => {
  b.innerHTML = '<b>Rule type:</b>';
  Object.entries(RULE_TYPES).forEach(([t, d]) => barButton(b, d.label, () => begin(t)));
  barButton(b, 'Cancel', () => home());
};

const begin = type => {
  const r = { type, a: null, b: null, text: '', ci: false, when: 'beforeSave' };
  if (RULE_TYPES[type].text) {
    const t = prompt(type === 'matches' ? 'Regular expression:' : 'Text:');
    if (t === null || t === '') return home();
    if (type === 'matches') { try { new RegExp(t); } catch (e) { alert('Invalid regular expression: ' + e.message); return home(); } }
    r.text = t;
  }
  if (type !== 'notEmpty') r.ci = confirm('Ignore upper/lower case? (OK = yes, Cancel = no)');
  waitPick('<b>Ctrl+click field A</b>', el => {
    r.a = { ...describe(el), label: labelOf(el) };
    if (!RULE_TYPES[type].two) return chooseWhen(r);
    waitPick('<b>Ctrl+click field B</b>', el2 => {
      const same = JSON.stringify(describe(el2)) === JSON.stringify(describe(el));
      if (same && !confirm('A and B are the same element. Are you sure?')) return home();
      r.b = { ...describe(el2), label: labelOf(el2) };
      chooseWhen(r);
    });
  });
};

const chooseWhen = r => {
  b.innerHTML = '<b>When should Auto check it?</b>';
  Object.entries(WHEN).forEach(([k, label]) => barButton(b, label, () => {
    r.when = k;
    cfg.rules.push(r);
    save();
    home('Added: ' + ruleText(r));
  }));
  barButton(b, 'Cancel', () => home());
};

const listRules = () => {
  if (!cfg.rules.length) { alert('There are no rules yet.'); return; }
  const n = prompt('Rules:\n' + cfg.rules.map((r, i) => (i + 1) + '. ' + ruleText(r)).join('\n') + '\n\nNumber of a rule to delete (empty = close):');
  const i = parseInt(n, 10) - 1;
  if (i >= 0 && i < cfg.rules.length) { cfg.rules.splice(i, 1); save(); home('Rule deleted.'); }
};

// Checks every rule right now, whatever its moment.
const checkNow = () => {
  const f = runRules(cfg.rules, null);
  alert(!cfg.rules.length ? 'There are no rules yet.' : f.length ? 'Failed:\n' + f.join('\n') : 'All ' + cfg.rules.length + ' rule(s) passed.');
};

home();
