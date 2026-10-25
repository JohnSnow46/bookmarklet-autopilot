// Check: runs the rules marked "manual only" on the current page (works on any page).
let cfg;
try { cfg = loadCfg(); } catch (e) { alert(e.message); return; }
const rules = ((cfg && cfg.rules) || []).filter(r => r.when === 'manual');
if (!rules.length) { alert('No "manual only" rules. Add some with the Validate bookmarklet.'); return; }
const failed = runRules(cfg.rules, 'manual');
alert(failed.length ? 'Failed:\n' + failed.join('\n') : 'All ' + rules.length + ' rule(s) passed.');
