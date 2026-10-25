// Play: repeats the recorded steps. EMBED is defined only by an exported bookmarklet (Export).
// The same source builds three bookmarklets (PLAY_MODE is set by the build):
//   Play (once) - one run;  Series - after each run waits for the next scan and runs again;
//   Dry run - checks which steps it can find on the current screen, highlights them, clicks and types nothing.
const MODE = typeof PLAY_MODE !== 'undefined' ? PLAY_MODE : 'once';
let cfg;
try { cfg = embeddedOrSaved(typeof EMBED !== 'undefined' ? EMBED : undefined); } catch (e) { alert(e.message); return; }
if (!cfg || cfg.v !== 4 || !cfg.macro) { alert('Nothing recorded yet. Use the Record bookmarklet first.'); return; }
// '' when every recorded step has the shape Play expects, otherwise what is wrong (checked before anything is done,
// so a damaged or hand-edited recording cannot stop half-way through with a script error).
const macroProblem = M => {
  if (!Array.isArray(M)) return 'the recording is not a list of steps';
  if (M.length > 500) return 'the recording has more than 500 steps';
  const isLoc = l => !!l && typeof l === 'object' && typeof l.sel === 'string' && !!l.sel
    && (l.frame === undefined || (Array.isArray(l.frame) && l.frame.every(f => typeof f === 'string')))
    && (l.alt === undefined || typeof l.alt === 'string');
  const SRC = [undefined, 'scan', 'copy', 'profile.name', 'profile.org'], MODES = ['fixed', 'only', 'profile.name', 'profile.org'];
  for (const [i, a] of M.entries()) {
    const bad = m => 'Step ' + (i + 1) + ': ' + m;
    if (!a || typeof a !== 'object') return bad('not a step');
    if (!['click', 'row', 'select', 'set'].includes(a.t)) return bad('unknown kind of step "' + a.t + '"');
    if (a.t === 'row' ? !isLoc(a.box) || typeof a.match !== 'string' || !a.match : !isLoc(a.loc)) return bad('the element is missing');
    if ((a.t === 'row' || a.t === 'select') && !MODES.includes(a.mode)) return bad('unknown choice "' + a.mode + '"');
    if (a.t === 'set' && !SRC.includes(a.src)) return bad('unknown source "' + a.src + '"');
    if (a.t === 'set' && a.src === 'copy' && !isLoc(a.from)) return bad('the field to copy from is missing');
    if (a.t === 'set' && !a.src && typeof a.value !== 'string') return bad('the text to type is missing');
    if (a.text !== undefined && typeof a.text !== 'string') return bad('the caption is not a text');
    if (a.cap !== undefined && typeof a.cap !== 'string') return bad('the caption is not a text');
    if ((a.t === 'row' || a.t === 'select') && a.mode === 'fixed' && !a.text) return bad('the choice to make is missing');
  }
  return '';
};
{
  const p = macroProblem(cfg.macro);
  if (p) { alert('The recording cannot be played, nothing was done.\n' + p + '\nRecord it again.'); return; }
}
if (!cfg.macro.length) { alert('The recording has no steps. Record it again.'); return; }
const M = cfg.macro, O = cfg.opts || {}, R = Array.isArray(cfg.rules) ? cfg.rules : [];
const SCAN = M.find(a => a.src === 'scan');
const WAIT = (O.waitSec >= 1 && O.waitSec <= 600 ? O.waitSec : 30) * 1000; // how long a step waits for its element

// Steps that may change data: the ones that ask "Save?", and clicks whose caption looks like saving, sending or
// deleting. A link (also one inside a list row) keeps only that word (cap), never the rest of its text.
const clicks = a => a.t === 'click' || a.t === 'row';
const heavy = a => clicks(a) && (!!a.confirm || SAVE_LIKE.test((a.t === 'click' && a.text) || a.cap || ''));
// Rules "before Save" are checked once, before the step that saves: the first that asks "Save?", else the first
// data-changing one. Rules "before Generate" before the first click after that step. The start check and the run use
// these same two steps, and a rule that no step would reach is refused: it must never be skipped without a word.
const SAVE_AT = (k => (k >= 0 ? k : M.findIndex(heavy)))(M.findIndex(a => clicks(a) && a.confirm));
const GEN_AT = SAVE_AT < 0 ? -1 : M.findIndex((a, k) => k > SAVE_AT && clicks(a));
if (MODE !== 'dry') { // Dry run changes nothing, and reports the rules itself
  const has = w => R.some(r => r && r.when === w);
  if (has('beforeSave') && SAVE_AT < 0) {
    alert('The recording has validation rules to check before Save, but Play cannot tell which step saves, so they would '
      + 'never be checked. Nothing was done.\nRecord again and give the Save step at "Ask Save? before which steps?", or remove those rules with Validate.');
    return;
  }
  if (has('beforeGenerate') && GEN_AT < 0) {
    alert('The recording has validation rules to check before Generate, but no click comes after the step that saves (step '
      + (SAVE_AT + 1) + '), so they would never be checked. Nothing was done.\nRemove those rules with Validate, or record the routine up to its end.');
    return;
  }
}

// The page may reload in the middle (and this script with it): clicking Play again continues for 60 seconds.
// The state belongs to this recording (h) and remembers the last data-changing step that was clicked (c).
// A tab opened by the page gets a copy of this tab's sessionStorage, so the state also says which tab wrote it (TAB:
// an id per tab; a copy of the opener's id is replaced by a new one).
const PK = 'playState', UK = 'playUncertain';
const djb = t => [...t].reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) | 0, 5381);
const HASH = djb(JSON.stringify(M));
const TAB = (() => {
  let id = getJSON('playTab', true), copy = false;
  try { copy = !!id && !!window.opener && JSON.parse(window.opener.sessionStorage.getItem('playTab')) === id; } catch (e) { /* another origin */ }
  if (typeof id !== 'string' || copy) { id = Math.random().toString(36).slice(2); setJSON('playTab', id, true); }
  return id;
})();
const mine = s => !!s && s.h === HASH && s.o === TAB;
// The scanned code on screen now, as a number (0 = none): tells a new item from the one a stopped run worked on.
const codeKey = () => { const el = SCAN && !SCAN.win && locate(SCAN.loc); const v = el && shown(el) ? el.value.trim() : ''; return v ? djb(v) : 0; };
const readState = () => {
  const s = getJSON(PK, true);
  return mine(s) && s.n === M.length && s.i < s.n && Date.now() - s.t < 60000 ? s : null;
};
let t0 = Date.now(); // start of the current run (kept across reloads for the log)
// i: the next step, c: the last data-changing step, k: the last click that went through, q: the code (codeKey)
const writeState = (i, p, c, k, q, t = Date.now()) => setJSON(PK, { i, n: M.length, t, p, t0, c, k, q, h: HASH, o: TAB }, true);
const clearState = () => drop(PK, true);

// Where a run that stopped before step i can go on (-1: it cannot), c and k as in writeState. What was typed or
// chosen after the last click that went through is gone once the page is refreshed, so it is done again (with the
// click that opened its list, if it ends in a list row); a step in the new tab needs the click that opens that tab
// again, unless that click changed data. Clicks before that are never repeated.
const opener = j => { while (j > 0 && M[j - 1].win) j--; return j - 1; };
const resumeAt = (c, k, i) => {
  const after = Math.max(c, k >= 0 ? k : c);
  let j = M.findIndex((x, n) => n > after && n < i && x.t !== 'click');
  if (j >= 0 && k > c && k === j - 1 && !heavy(M[k]) && M.slice(j, i + 1).some(x => x.t === 'row')) j = k;
  if (j >= 0) i = j;
  if (M[i] && M[i].win) i = opener(i) > c ? opener(i) : -1;
  return i;
};
// A run that stopped (or was cancelled) while waiting after a data-changing click, e.g. until a refresh brought a
// Print button, is "parked": its state stays, without a time limit, and it can continue (see resumeAt). So does a
// reload that was not continued in time. Continuing always asks first.
const parked = () => {
  const s = getJSON(PK, true);
  return mine(s) && s.n === M.length && s.i < s.n && s.c >= 0 && !readState() && resumeAt(s.c, s.k, s.i) >= 0 ? s : null;
};
// true: continue the parked run p; false: do nothing; null: it was forgotten, start a new run.
const askParked = p => {
  const a = M[p.i], target = a.t === 'row' ? a.box : a.loc, code = codeKey(), at = resumeAt(p.c, p.k, p.i);
  if (!a.win && !usable(target, document, a.t === 'click' ? a.text : undefined) && code && code !== p.q) {
    if (confirm('A new code is ready, and the last run in this tab stopped before step ' + (p.i + 1) + ' (' + say(a) + '), which is not on this screen.\n'
      + 'Start a new run with it from step 1? Step ' + (p.c + 1) + ' (' + say(M[p.c]) + ') of the last run was already clicked: '
      + 'check that item in the application.\n\nOK = start a new run\nCancel = continue the last run instead, or forget it (next questions)')) {
      clearState();
      drop(UK, true);
      return null;
    }
  }
  if (confirm('The last run in this tab clicked step ' + (p.c + 1) + ' (' + say(M[p.c]) + ') and stopped before step ' + (p.i + 1)
    + ' (' + say(M[p.i]) + ').\nIt can continue at step ' + (at + 1) + ' (' + say(M[at]) + '). '
    + (at < p.i ? 'Steps ' + (at + 1) + ' to ' + p.i + ' are done again: a refresh clears what they typed or chose. Nothing before them is repeated.'
      : 'Nothing that was already done is repeated.')
    + '\n\nOK = continue at step ' + (at + 1) + '\nCancel = do not continue')) return true;
  if (!confirm('Forget that run and start a new one from step 1? Step ' + (p.c + 1) + ' was already clicked, so that item may '
    + 'already be saved: check the application first.\n\nOK = forget it and start a new run\nCancel = do nothing')) return false;
  clearState();
  drop(UK, true);
  return null;
};

// Step number of a data-changing click that an earlier run in this tab made before it stopped (0 = none). Starting
// again from step 1 would repeat it, so the user has to decide. Also covers a reload after it that was not continued
// in time. It does not expire: only the user's answer (or another recording) clears it.
const unfinishedSave = any => {
  const u = getJSON(UK, true);
  if (mine(u)) return u.step;
  const s = getJSON(PK, true);
  if (mine(s) && s.i >= s.n) { clearState(); return 0; } // the last step went through: that run is complete
  return mine(s) && s.c >= 0 && (any || !readState()) ? s.c + 1 : 0;
};
const askAfterUnfinished = any => {
  const n = unfinishedSave(any);
  if (!n) return true;
  if (!confirm('The last run in this tab clicked step ' + n + ' (' + say(M[n - 1]) + ') and stopped before the end, so that data may already be saved.\n'
    + 'Check the application first: a new run repeats every step from step 1.\n\nOK = start a new run anyway\nCancel = do nothing')) return false;
  drop(UK, true);
  clearState();
  return true;
};

const text = (v, p) => (v === 'profile.name' ? p.name : v === 'profile.org' ? p.org : '');
const press = el => {
  const W = winOf(el);
  ['mousedown', 'mouseup'].forEach(t => el.dispatchEvent(new W.MouseEvent(t, { bubbles: true, cancelable: true, view: W })));
  el.click();
};

// Rows of a recorded list step that match the wanted text (narrowed by the organization when rows show it).
const listRows = (a, d, profile) => {
  const want = a.mode === 'fixed' ? norm(a.text, true) : a.mode === 'only' || !profile ? '' : norm(text(a.mode, profile), true);
  const more = a.mode === 'profile.name' && profile && profile.org ? norm(profile.org, true) : '';
  const box = locate(a.box, d);
  if (!box) return [];
  const found = new Map();
  box.querySelectorAll(a.match).forEach(el => {
    const row = rowOf(el);
    if (shown(el) && norm(row.textContent, true).includes(want) && !found.has(row)) found.set(row, el);
  });
  const all = [...found], narrowed = all.filter(([r]) => norm(r.textContent, true).includes(more));
  return narrowed.length ? narrowed : all;
};

// One run of the recording. Returns 'ok', or 'cancelled' when "Save?" was declined; throws on a problem, and
// throws cancelled() when ctl.halt() says the user stopped it. ctl.progress(i) is told which step starts.
const run = async (st, ctl) => {
  const wins = {}; // wins[1] = the new tab opened by the page
  const oo = window.open;
  let i = st ? st.i : 0, watch = null; // watch: error texts that were already on screen before Save
  let committed = st && st.c >= 0 ? st.c : -1, finished = false; // committed: the last data-changing click (see heavy)
  let clicked = st && st.k >= 0 ? st.k : committed; // the last click that went through
  const code = (st && st.q) || codeKey();
  run.stage = run.where = 'start';
  if (st && committed >= 0) { const at = resumeAt(committed, clicked, i); if (at >= 0) i = at; }
  const needsProfile = M.some(a => /^profile/.test(a.src || a.mode || ''));
  const profile = needsProfile ? (st && st.p) || chooseProfile(cfg) : null;
  const wrap = function (...a) {
    window.open = oo;
    const w = oo.apply(window, a);
    if (!w) alert('The browser blocked the new tab. Allow pop-ups for this site.'); else wins[1] = w;
    return w;
  };
  window.open = wrap;
  const note = () => 'Step ' + (committed + 1) + ' (' + say(M[committed]) + ') was already clicked, so the data may already be saved. '
    + 'Check the application before you run Play again.';
  run.note = '';
  let park = false;
  try {
    for (; i < M.length; i++) {
      const a = M[i];
      if (ctl.halt()) throw cancelled(); // between steps; a click that was already sent is never undone
      run.stage = 'step ' + (i + 1) + ' (' + say(a, true) + ')'; // for the log: no typed or chosen texts
      run.where = 'step ' + (i + 1) + ' (' + say(a) + ')'; // for the message on screen
      ctl.progress(i);
      writeState(i, profile, committed, clicked, code); // an interrupted step is retried; a click that went through is not repeated (see below)
      const root = () => (a.win ? wins[1] && wins[1].document : document);
      // Waits until fn finds what it needs; on a timeout why() says what is wrong (hidden, disabled, ambiguous...).
      const wait = (fn, what, why) => waitForOr(() => { const d = root(); return d ? fn(d) : null; },
        () => (watch ? errorTexts().find(x => !watch.includes(x)) : null), what, WAIT, ctl.halt).catch(e => {
        if (!e.timeout) throw e;
        const d = root();
        throw Object.assign(new Error('Cannot use ' + what + ': ' + (d ? why(d) : 'the new tab is not open') + ' (waited ' + WAIT / 1000 + ' s).'), { waited: true });
      });
      const element = (c, what, text) => wait(d => usable(c, d, text), what, d => whyNot(c, d, text) || 'it kept changing');
      const known = errorTexts();
      // before a click or a list row: the rules due at this step, then "Save?" if it asks; false = declined
      const gate = () => {
        const fail = (w, msg) => {
          const f = runRules(R, w, root());
          if (f.length) throw Object.assign(new Error(msg + '\n' + f.join('\n')), { rule: committed >= 0 }); // after a Save it can continue here
        };
        if (i === GEN_AT) fail('beforeGenerate', 'Validation failed before the next step after Save.');
        if (i === SAVE_AT) fail('beforeSave', 'Validation failed, nothing was saved.');
        return !(a.confirm && O.confirmSave !== false && !confirm('Save?'));
      };
      const done = () => { // after a click or a list row went through
        clicked = i;
        if (heavy(a)) committed = i;
        writeState(i + 1, profile, committed, clicked, code); // the click may reload the page: continue after it
        watch = heavy(a) ? known : null; // from here on an application error stops the run
      };

      if (a.t === 'click') {
        // a link keeps only its Save-like word (cap): it is named by that word, never by the rest of its text
        const el = await element(a.loc, a.text ? '"' + a.text + '"' : a.cap ? 'the "' + a.cap + '" link' : '[' + a.loc.label + ']', a.text);
        if (!gate()) { if (committed >= 0) run.note = note(); return 'cancelled'; }
        watch = null;
        press(el);
        done();
      } else if (a.t === 'row') {
        watch = null;
        if (/^profile/.test(a.mode) && !norm(text(a.mode, profile))) {
          throw new Error('Your profile has no ' + (a.mode === 'profile.org' ? 'organization' : 'name') + ', so the row cannot be chosen. Add it with Show.');
        }
        let last = -1, steady = 0, now = [];
        await wait(d => {
          now = listRows(a, d, profile);
          steady = now.length && now.length === last ? steady + 1 : 0; // wait until the list stops changing
          last = now.length;
          return steady >= 2;
        }, 'the list row', // without its text: this message also goes into the run log
        d => (whyNot(a.box, d) ? 'the list is ' + whyNot(a.box, d) : now.length ? 'the list kept changing' : 'no row of the list matches'));
        if (now.length > 1) {
          throw new Error('More than one row matches:\n' + now.map(([r], k) => (k + 1) + ') ' + norm(r.textContent)).join('\n')
            + '\nNothing was selected. Choose by hand, or add your organization to the profile (Show).');
        }
        if (!gate()) { if (committed >= 0) run.note = note(); return 'cancelled'; }
        press(now[0][1]);
        done();
        await sleep(300);
      } else if (a.t === 'select') {
        const el = await element(a.loc, '"' + a.loc.label + '"');
        watch = null;
        const name = a.mode.startsWith('profile') ? text(a.mode, profile) : a.text;
        const opts = [...el.options];
        const o = opts.find(x => x.text.trim() === name) || opts.filter(x => norm(x.text, true).includes(norm(name, true)) && x.value)[0];
        if (!name || !o) throw new Error('No such option in the list "' + a.loc.label + '": ' + name);
        setVal(el, o.value);
        if (norm(readVal(el)) !== norm(o.text)) throw new Error('The list "' + a.loc.label + '" did not keep the choice: it shows "' + readVal(el) + '".');
      } else { // set
        const el = await element(a.loc, '"' + a.loc.label + '"');
        watch = null;
        if (a.src === 'scan') {
          if (!el.value.trim()) throw new Error('Scan a code into "' + a.loc.label + '" first.');
        } else {
          let v = a.value;
          if (a.src === 'copy') {
            const from = await wait(d => locate(a.from, d), '"' + a.from.label + '"', d => whyNot(a.from, d) || 'it kept changing');
            v = readVal(from);
          } else if (a.src) v = text(a.src, profile);
          if (v === undefined || (a.src && !v.trim())) throw new Error('There is nothing to type into "' + a.loc.label + '".');
          setVal(el, v);
          if (norm(readVal(el)) !== norm(v)) throw new Error('The field "' + a.loc.label + '" did not keep the value: it shows "' + short(readVal(el)) + '" instead of "' + short(v) + '".');
        }
      }
    }
    finished = true;
    return 'ok';
  } catch (e) {
    // stopped while waiting (or cancelled) after a data-changing click: step i was not done, so it can continue there
    if (e.waited && SCAN && M[i - 1] === SCAN) {
      e.message += '\nIf the code has to be confirmed with Enter (a scanner does that by itself), press Enter after typing it.';
    }
    // after a data-changing click, a stop while waiting, a cancel or a failed rule can continue (see resumeAt)
    const at = committed >= 0 && (e.waited || e.cancel || e.rule) ? resumeAt(committed, clicked, i) : -1;
    park = at >= 0;
    if (committed >= 0) {
      e.note = note() + (park ? ' Or continue at step ' + (at + 1) + ': refresh the page if it needs it, then click Play again.' : '');
      if (!e.cancel) e.message += '\n\n' + e.note;
    }
    throw e;
  } finally {
    if (park) writeState(i, profile, committed, clicked, code, 0); // time 0: continuing it always asks first
    else clearState();
    // never start this recording again from step 1 without asking, once a Save went through and the run did not end
    if (finished) drop(UK, true);
    else if (committed >= 0) setJSON(UK, { at: Date.now(), step: committed + 1, h: HASH, o: TAB }, true);
    if (window.open === wrap) window.open = oo; // unused; a replacement made by the page itself stays
  }
};

// Run log on this computer: time, duration, result and the step where it stopped. No codes, products or people.
const log = (result, e) => {
  const prev = getJSON('autoLog'), L = Array.isArray(prev) ? prev : []; // a damaged log starts again
  L.push({ at: new Date().toISOString(), ms: Date.now() - t0, result, mode: MODE,
    step: result === 'stopped' ? run.stage : '', why: e ? String(e.message).split(/[:\n]/)[0].slice(0, 80) : '' });
  setJSON('autoLog', L.slice(-500)); // a full or blocked storage must not hide why the run stopped
};

// Dry run: which steps can be found on the screen as it is now. Nothing is clicked or typed.
const dryRun = async () => {
  const profile = getProfiles(cfg)[0] || null;
  const lines = [];
  for (const [i, a] of M.entries()) {
    let res;
    if (a.win) res = 'in the new tab, not checked';
    else if (a.t === 'row') {
      const n = listRows(a, document, profile).length;
      const why = locate(a.box) ? '' : whyNot(a.box);
      res = why ? 'list ' + why : n === 1 ? 'OK, 1 matching row' : n + ' matching rows' + (n ? ' (Play would stop)' : '');
    } else {
      const why = whyNot(a.loc, document, a.t === 'click' ? a.text : ''), el = locate(a.loc), ok = !why;
      res = why || 'OK';
      if (ok) {
        el.scrollIntoView({ block: 'center' });
        const was = el.style.outline; // the page's own outline is put back
        el.style.outline = '3px solid rgb(46,125,50)';
        await sleep(500);
        el.style.outline = was;
      }
      if (ok && a.src === 'copy' && !locate(a.from)) res += ', but the field to copy from is missing';
      if (ok && a.src === 'scan' && !String(el.value || '').trim()) res += ', but it is empty: scan a code first';
    }
    lines.push((i + 1) + '. ' + say(a) + ': ' + res);
  }
  const fails = R.length ? runRules(R, null) : [];
  alert('Dry run - nothing was clicked or typed.\n\n' + lines.join('\n')
    + (R.length ? '\n\nRules right now:\n' + (fails.length ? fails.join('\n') : 'all ' + R.length + ' pass') : '')
    + '\n\nRun it again on the next screens to check the remaining steps.');
};

// Series: run, then wait for the next scanned code and run again, until Stop.
const series = async () => {
  if (!SCAN) { alert('The recording has no scan step, so Series cannot tell when the next product comes.'); return; }
  const { bar, set } = statusBar('__series', 'Series');
  let stop = false, done = 0;
  const show = msg => set(done + ' done. ' + msg);
  const halt = () => { if (!stop) { stop = true; show('Stopping...'); } };
  barButton(bar, 'Stop (Esc)', halt);
  const offEsc = onEsc(halt);
  for (;;) {
    show('Scan the next code. (Go back to the screen with the code field first, e.g. New scan.)');
    // A code counts once the scanner has finished typing it (unchanged for ~0.6 s). After a run the field must
    // first disappear or be empty, so the same code scanned again (two identical items) is a new product.
    let code = '', same = 0, armed = done === 0;
    while (!stop) {
      const el = locate(SCAN.loc);
      const v = el && shown(el) ? el.value.trim() : '';
      if (!v) armed = true;
      same = armed && v && v === code ? same + 1 : 0;
      code = v;
      if (same >= 3) break;
      await sleep(200);
    }
    if (stop) break;
    show('Working on product ' + (done + 1) + '...');
    t0 = Date.now();
    let r;
    try {
      r = await run(null, { halt: () => stop, progress: i => { if (!stop) show('Working on product ' + (done + 1) + ': step ' + (i + 1) + '/' + M.length + '.'); } });
    } catch (e) {
      if (e.cancel) { log('cancelled', e); if (e.note) alert('Series stopped. ' + e.note); break; } // Stop pressed during a run
      log('stopped', e); show('Stopped.'); alert('Series stopped at ' + run.where + ':\n' + e.message); break;
    }
    log(r);
    if (r !== 'ok') { if (run.note) alert('Series was cancelled at "Save?". ' + run.note); break; }
    done++;
  }
  offEsc();
  bar.remove();
  alert('Series finished: ' + done + ' product(s).');
};

(async () => {
  if (MODE === 'dry') return dryRun(); // changes nothing: no lock needed
  // Without a working sessionStorage (e.g. an exported Play on a page that blocks storage) a stop after Save would
  // leave no trace, and the next run would repeat it without asking: refuse recordings that change data.
  if (!setJSON('playProbe', 1, true) && M.some(heavy)) {
    alert('This page does not let the bookmarklet keep track of a run (browser storage is blocked), so Play could not '
      + 'warn you before saving twice. Allow site data for this page, or do it by hand.');
    return;
  }
  drop('playProbe', true);
  if (!lockRun(MODE === 'series' ? 'Series' : 'Play')) return;
  try {
    let st = readState(); // a run that a page reload interrupted continues without asking
    if (MODE !== 'series' && !st && parked()) {
      const go = askParked(parked());
      if (go === false) return;
      if (go) st = parked();
    }
    // Series never continues an interrupted run, so it always asks
    if (MODE === 'series' ? !askAfterUnfinished(true) : !st && !askAfterUnfinished()) return;
    await (MODE === 'series' ? series() : once(st));
  } finally { unlockRun(); }
})();

async function once(st) {
  if (st && st.t0 && Date.now() - st.t < 60000) t0 = st.t0; // not for a parked run, which may have waited for hours
  // A bar with the progress and Cancel (also Esc) while Play works; removed whatever the outcome.
  const { bar, set: show } = statusBar('__play', 'Play');
  let stop = false;
  const cancel = () => { if (!stop) { stop = true; show('Cancelling...'); } };
  barButton(bar, 'Cancel (Esc)', cancel);
  const offEsc = onEsc(cancel);
  const finish = (msg, color) => {
    offEsc();
    if (!msg) return bar.remove();
    bar.querySelectorAll('button').forEach(x => x.remove());
    show(msg);
    bar.style.background = color;
    setTimeout(() => bar.remove(), 3000);
  };
  try {
    const r = await run(st, { halt: () => stop, progress: i => { if (!stop) show('step ' + (i + 1) + '/' + M.length + ': ' + say(M[i])); } });
    log(r);
    finish(r === 'ok' ? 'Done, ' + M.length + ' steps.' : 'Cancelled at "Save?".', r === 'ok' ? 'rgb(46,125,50)' : 'rgb(90,90,90)');
    if (r !== 'ok' && run.note) alert('Play was cancelled at "Save?". ' + run.note);
  } catch (e) {
    if (e.cancel) {
      log('cancelled', e);
      finish('Cancelled at ' + run.stage + '.', 'rgb(90,90,90)');
      if (e.note) alert('Play was cancelled. ' + e.note);
      return;
    }
    log('stopped', e);
    finish();
    alert('Play stopped at ' + run.where + ':\n' + e.message);
  }
}
