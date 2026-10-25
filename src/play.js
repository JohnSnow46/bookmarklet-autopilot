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

// The page may reload in the middle (and this script with it): clicking Play again continues for 60 seconds.
const PK = 'playState';
const readState = () => {
  const s = getJSON(PK, true);
  return s && s.n === M.length && Date.now() - s.t < 60000 ? s : null;
};
let t0 = Date.now(); // start of the current run (kept across reloads for the log)
const writeState = (i, p) => setJSON(PK, { i, n: M.length, t: Date.now(), p, t0 }, true);
const clearState = () => drop(PK, true);

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

// One run of the recording. Returns 'ok', or 'cancelled' when "Save?" was declined; throws on a problem.
const run = async st => {
  const wins = {}; // wins[1] = the new tab opened by the page
  const oo = window.open;
  let i = st ? st.i : 0, watch = null; // watch: error texts that were already on screen before Save
  run.stage = 'start';
  const needsProfile = M.some(a => /^profile/.test(a.src || a.mode || ''));
  const profile = needsProfile ? (st && st.p) || chooseProfile(cfg) : null;
  window.open = function (...a) {
    window.open = oo;
    const w = oo.apply(window, a);
    if (!w) alert('The browser blocked the new tab. Allow pop-ups for this site.'); else wins[1] = w;
    return w;
  };
  try {
    for (; i < M.length; i++) {
      const a = M[i];
      run.stage = 'step ' + (i + 1) + ' (' + say(a) + ')';
      writeState(i, profile); // an interrupted step is retried; a click that went through is not repeated (see below)
      const root = () => (a.win ? wins[1] && wins[1].document : document);
      // Waits until fn finds what it needs; on a timeout why() says what is wrong (hidden, disabled, ambiguous...).
      const wait = (fn, what, why) => waitForOr(() => { const d = root(); return d ? fn(d) : null; },
        () => (watch ? errorTexts().find(x => !watch.includes(x)) : null), what, WAIT).catch(e => {
        if (!e.timeout) throw e;
        const d = root();
        throw new Error('Cannot use ' + what + ': ' + (d ? why(d) : 'the new tab is not open') + ' (waited ' + WAIT / 1000 + ' s).');
      });
      const element = (c, what, text) => wait(d => usable(c, d, text), what, d => whyNot(c, d, text) || 'it kept changing');
      const known = errorTexts();

      if (a.t === 'click') {
        const el = await element(a.loc, a.text ? '"' + a.text + '"' : '[' + a.loc.label + ']', a.text);
        if (a.confirm) {
          const f = runRules(R, 'beforeSave', root());
          if (f.length) throw new Error('Validation failed, nothing was saved.\n' + f.join('\n'));
          if (O.confirmSave !== false && !confirm('Save?')) return 'cancelled';
        }
        watch = null;
        press(el);
        writeState(i + 1, profile); // the click may reload the page: continue after it
        watch = a.confirm ? known : null; // from here on an application error stops the run
      } else if (a.t === 'row') {
        watch = null;
        let last = -1, steady = 0, now = [];
        await wait(d => {
          now = listRows(a, d, profile);
          steady = now.length && now.length === last ? steady + 1 : 0; // wait until the list stops changing
          last = now.length;
          return steady >= 2;
        }, 'the list row' + (a.text ? ' "' + short(a.text) + '"' : ''),
        d => (whyNot(a.box, d) ? 'the list is ' + whyNot(a.box, d) : now.length ? 'the list kept changing' : 'no row of the list matches'));
        if (now.length > 1) {
          throw new Error('More than one row matches:\n' + now.map(([r], k) => (k + 1) + ') ' + norm(r.textContent)).join('\n')
            + '\nNothing was selected. Choose by hand, or add your organization to the profile (Show).');
        }
        press(now[0][1]);
        writeState(i + 1, profile);
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
    return 'ok';
  } finally {
    clearState();
    if (window.open !== oo && !wins[1]) window.open = oo;
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
        el.style.outline = '3px solid rgb(46,125,50)';
        await sleep(500);
        el.style.outline = '';
      }
      if (ok && a.src === 'copy' && !locate(a.from)) res += ', but the field to copy from is missing';
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
  const bar = makeBar('__series');
  let stop = false, done = 0;
  const show = msg => {
    bar.textContent = '';
    const b = document.createElement('b');
    b.textContent = 'Series: ';
    bar.appendChild(b);
    bar.appendChild(document.createTextNode(done + ' done. ' + msg));
    barButton(bar, 'Stop', () => { stop = true; show('Stopping...'); });
  };
  for (;;) {
    show('Scan the next code.');
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
    try { r = await run(null); } catch (e) { log('stopped', e); show('Stopped.'); alert('Series stopped at ' + run.stage + ':\n' + e.message); break; }
    log(r);
    if (r !== 'ok') break;
    done++;
  }
  bar.remove();
  alert('Series finished: ' + done + ' product(s).');
};

(async () => {
  if (MODE === 'dry') return dryRun();
  if (MODE === 'series') return series();
  const st = readState();
  if (st && st.t0) t0 = st.t0;
  try {
    log(await run(st));
  } catch (e) {
    log('stopped', e);
    alert('Play stopped at ' + run.stage + ':\n' + e.message);
  }
})();
