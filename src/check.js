// Check: runs the rules marked "manual only" on the current page (works on any page).
const cfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
const rules = ((cfg && cfg.rules) || []).filter(r => r.when === 'manual');
if (!rules.length) { alert('No "manual only" rules. Add some with the Validate bookmarklet.'); return; }
const failed = runRules(cfg.rules, 'manual');
alert(failed.length ? 'Failed:\n' + failed.join('\n') : 'All ' + rules.length + ' rule(s) passed.');
