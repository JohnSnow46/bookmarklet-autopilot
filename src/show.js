// Show: a readable summary of the saved configuration, and the profiles (who / which organization Auto selects).
const cfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
const mine = (() => { try { return JSON.parse(localStorage.getItem('autoProfiles') || 'null'); } catch (_) { return null; } })();
if (!cfg && !(mine && mine.length)) { alert('Nothing learned yet. Run the Learn bookmarklet first.'); return; }
const c = cfg || { steps: {}, opts: {}, rules: [] };

const profiles = () => getProfiles(c).map((p, i) => (i + 1) + '. ' + profileText(p)).join('\n') || '(none: Auto asks on its first run)';
const steps = Object.entries(c.steps || {}).map(([k, s]) => s.skipped
  ? k + ': (skipped)'
  : k + ': ' + (s.tag || '?') + (s.text ? ' "' + s.text + '"' : '') + (s.frame && s.frame.length ? ' [in iframe]' : '') + (s.alt ? ' [+fallback]' : '') + '\n    ' + s.sel);
const o = c.opts || {};
alert('Steps:\n' + steps.join('\n')
  + '\n\nAppend text: "' + (o.extraLine || '') + '"'
  + '\nAsk "Save?": ' + (o.confirmSave ? 'yes' : 'no')
  + '\nProfiles (' + ((mine && mine.length) ? 'personal, this computer' : 'from the configuration') + '):\n' + profiles()
  + '\n\nValidation rules:\n' + ((c.rules || []).map((r, i) => (i + 1) + '. ' + ruleText(r)).join('\n') || '(none)'));

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
