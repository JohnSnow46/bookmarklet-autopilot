// Export: builds a Play (or Auto) bookmarklet with the configuration built in, to hand over to a colleague.
// The build substitutes the placeholders below with the sources of the Auto and Play bookmarklets (as strings).
const AUTO = __AUTO__;
const PLAY = __PLAY__;
const cfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
if (!cfg || !(cfg.macro || (cfg.steps && cfg.steps.search))) { alert('Nothing learned yet. Run the Learn bookmarklet first.'); return; }
const out = JSON.parse(JSON.stringify(cfg));
out.opts = out.opts || {};
const mine = getProfiles(cfg);
out.opts.profiles = mine;
if (mine.length && !confirm('Include your profile(s)?\n' + mine.map(profileText).join('\n') + '\n\nOK = include\nCancel = leave out, the colleague will be asked for their own on the first run')) out.opts.profiles = [];
// Show what is about to leave this computer: fixed texts typed or chosen in the recording, and the append text.
const fixed = (out.macro || []).filter(a => (a.t === 'set' && !a.src) || (a.t !== 'click' && a.mode === 'fixed' && a.text)).map(say);
if (out.opts.extraLine) fixed.push('append text "' + short(out.opts.extraLine) + '"');
if (fixed.length && !confirm('The exported code will contain these fixed texts (readable by anyone who has the code):\n' + fixed.join('\n') + '\n\nNothing else from the page is included. Continue?')) return;
const code = 'javascript:(()=>{const EMBED=' + JSON.stringify(enc(JSON.stringify(out))) + ';' + (cfg.v === 4 ? PLAY : AUTO) + '})();';
const note = 'Copied the ' + (cfg.v === 4 ? 'Play' : 'Auto') + ' bookmarklet with your configuration built in. Create a new bookmark and paste it into the URL field. Send it only through internal channels.';
const fallback = () => prompt('Copy this code (Ctrl+C):', code);
try { navigator.clipboard.writeText(code).then(() => alert(note), fallback); } catch (_) { fallback(); }
