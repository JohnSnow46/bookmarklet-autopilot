// Show: a readable summary of the saved configuration.
const cfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
if (!cfg) { alert('Nothing learned yet. Run the Learn bookmarklet first.'); return; }
const steps = Object.entries(cfg.steps || {}).map(([k, c]) => c.skipped
  ? k + ': (skipped)'
  : k + ': ' + (c.tag || '?') + (c.text ? ' "' + c.text + '"' : '') + (c.frame && c.frame.length ? ' [in iframe]' : '') + (c.alt ? ' [+fallback]' : '') + '\n    ' + c.sel);
const o = cfg.opts || {};
alert('Steps:\n' + steps.join('\n')
  + '\n\nAppend text: "' + (o.extraLine || '') + '"'
  + '\nList option: ' + (o.userOption ? '"' + o.userOption + '"' : '(none / asked on first run)')
  + '\nAsk "Save?": ' + (o.confirmSave ? 'yes' : 'no')
  + '\n\nValidation rules:\n' + ((cfg.rules || []).map((r, i) => (i + 1) + '. ' + ruleText(r)).join('\n') || '(none)'));
