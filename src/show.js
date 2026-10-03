// Show: a readable summary of the saved configuration, and the profiles (who / which organization Auto selects).
const cfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
const mine = (() => { try { return JSON.parse(localStorage.getItem('autoProfiles') || 'null'); } catch (_) { return null; } })();
if (!cfg && !(mine && mine.length)) { alert('Nothing learned yet. Run the Learn bookmarklet first.'); return; }
const c = cfg || { steps: {}, opts: {}, rules: [] };

const profiles = () => getProfiles(c).map((p, i) => (i + 1) + '. ' + profileText(p)).join('\n') || '(none: Auto asks on its first run)';
const steps = c.macro ? c.macro.map((a, i) => (i + 1) + '. ' + say(a) + (a.confirm ? '   [asks "Save?"]' : '')) : Object.entries(c.steps || {}).map(([k, s]) => s.skipped
  ? k + ': (skipped)'
  : k + ': ' + (s.tag || '?') + (s.text ? ' "' + s.text + '"' : '') + (s.frame && s.frame.length ? ' [in iframe]' : '') + (s.alt ? ' [+fallback]' : '') + '\n    ' + s.sel);
const o = c.opts || {};
alert((c.macro ? 'Recorded steps:\n' : 'Steps:\n') + steps.join('\n')
  + '\n\nAppend text: "' + (o.extraLine || '') + '"'
  + '\nAsk "Save?": ' + (o.confirmSave ? 'yes' : 'no')
  + '\nProfiles (' + ((mine && mine.length) ? 'personal, this computer' : 'from the configuration') + '):\n' + profiles()
  + '\n\nValidation rules:\n' + ((c.rules || []).map((r, i) => (i + 1) + '. ' + ruleText(r)).join('\n') || '(none)'));

// Run log (written by Play and Series): counts, average time, where runs stopped.
let L = [];
try { L = JSON.parse(localStorage.getItem('autoLog') || '[]'); } catch (_) {}
if (L.length) {
  const day = new Date().toISOString().slice(0, 10);
  const ok = L.filter(x => x.result === 'ok'), today = L.filter(x => x.at.slice(0, 10) === day);
  const avg = ok.length ? Math.round(ok.reduce((s, x) => s + x.ms, 0) / ok.length / 1000) : 0;
  const where = {};
  L.filter(x => x.result === 'stopped').forEach(x => { const k = x.step + (x.why ? ': ' + x.why : ''); where[k] = (where[k] || 0) + 1; });
  const top = Object.entries(where).sort((p, q) => q[1] - p[1]).slice(0, 5).map(([k, n]) => n + 'x ' + k);
  alert('Run log (' + L.length + ' runs since ' + L[0].at.slice(0, 10) + ')\n'
    + 'Today: ' + today.length + ' runs, ' + today.filter(x => x.result === 'ok').length + ' completed\n'
    + 'All: ' + ok.length + ' completed, ' + L.filter(x => x.result === 'stopped').length + ' stopped, ' + L.filter(x => x.result === 'cancelled').length + ' cancelled at "Save?"\n'
    + 'Average time of a completed run: ' + avg + ' s'
    + (top.length ? '\n\nWhere runs stopped most often:\n' + top.join('\n') : ''));
  if (!confirm('Keep the run log? (OK = keep, Cancel = clear it)')) localStorage.removeItem('autoLog');
}

// Profiles are personal to this computer: they override the ones in the configuration.
if (confirm('Change the profiles (who and which organization Auto selects)?')) {
  const list = getProfiles(c).map(p => ({ ...p }));
  for (;;) {
    const a = prompt('Profiles:\n' + (list.map((p, i) => (i + 1) + '. ' + profileText(p)).join('\n') || '(none)')
      + '\n\nAdd: type  name; organization  (the organization can be empty)\nDelete: type its number\nFinish: leave empty or Cancel');
    if (a === null || !a.trim()) break;
    const t = a.trim();
    if (/^\d+$/.test(t)) {
      const i = parseInt(t, 10) - 1;
      if (i >= 0 && i < list.length) list.splice(i, 1);
    } else {
      const parts = t.split(';');
      if (parts[0].trim()) list.push({ name: parts[0].trim(), org: parts.slice(1).join(';').trim() });
    }
  }
  if (list.length) localStorage.setItem('autoProfiles', JSON.stringify(list)); else localStorage.removeItem('autoProfiles');
  localStorage.removeItem('autoProfileIdx');
  alert('Profiles now:\n' + profiles());
}
