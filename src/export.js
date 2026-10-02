// Export: builds an Auto bookmarklet with the configuration built in, to hand over to a colleague.
// The build substitutes the placeholder below with the source of the Auto bookmarklet (as a string).
const AUTO = __AUTO__;
const cfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
if (!cfg || !cfg.steps || !cfg.steps.search) { alert('Nothing learned yet. Run the Learn bookmarklet first.'); return; }
const out = JSON.parse(JSON.stringify(cfg));
out.opts = out.opts || {};
const mine = getProfiles(cfg);
out.opts.profiles = mine;
if (mine.length && !confirm('Include your profile(s)?\n' + mine.map(profileText).join('\n') + '\n\nOK = include\nCancel = leave out, the colleague will be asked for their own on the first run')) out.opts.profiles = [];
const code = 'javascript:(()=>{const EMBED=' + JSON.stringify(enc(JSON.stringify(out))) + ';' + AUTO + '})();';
const note = 'Copied the Auto bookmarklet with your configuration built in. Create a new bookmark and paste it into the URL field. Send it only through internal channels.';
const fallback = () => prompt('Copy this code (Ctrl+C):', code);
try { navigator.clipboard.writeText(code).then(() => alert(note), fallback); } catch (_) { fallback(); }
