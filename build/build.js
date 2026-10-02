// Sources (src/*.js) → one-line bookmarklets in dist/*.txt
const fs = require('fs'), path = require('path');
const crypto = require('crypto');
const { minify } = require('terser');

const root = path.join(__dirname, '..');
const SCRIPTS = ['learn', 'auto', 'validate', 'check', 'show', 'export']; // auto must come before export

// Security guard: bookmarklets must never talk to the network or run dynamic code.
const FORBIDDEN = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|eval|importScripts)\b|new Function|document\.cookie|import\(/;

function check(name, code) {
  const bad = [];
  if (code.includes('#')) bad.push('a hash character');
  if (code.includes('%')) bad.push('a percent character');
  if (/[\r\n]/.test(code)) bad.push('a newline');
  if (!code.startsWith('javascript:')) bad.push('missing javascript: prefix');
  const m = code.match(FORBIDDEN);
  if (m) bad.push('forbidden API: ' + m[0]);
  if (bad.length) throw new Error('Bookmarklet "' + name + '" is invalid: ' + bad.join(', '));
}

async function buildOne(name, built) {
  const common = fs.readFileSync(path.join(root, 'src', 'common.js'), 'utf8');
  let body = fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8');
  // Export embeds the finished Auto bookmarklet (without the javascript: prefix) as a string.
  if (body.includes('__AUTO__')) body = body.replace('__AUTO__', () => JSON.stringify(built.auto.slice('javascript:'.length)));
  const wrapped = '(()=>{\n' + common + '\n' + body + '\n})();';
  const out = await minify(wrapped, {
    compress: { passes: 2 },
    mangle: true,
    format: { ascii_only: true, comments: false, semicolons: true },
  });
  const code = 'javascript:' + out.code;
  check(name, code);
  return code;
}

// What the installer page says about each bookmarklet.
const INFO = {
  learn: ['Learn', 'Teach the process once: Ctrl+click each element it asks for.'],
  auto: ['Auto', 'Run the whole process after you have scanned a code.'],
  validate: ['Validate', 'Add checks, for example "this field equals that field" or "not empty".'],
  check: ['Check', 'Run the "manual only" checks on the current page.'],
  show: ['Show', 'Show what has been learned.'],
  export: ['Export', 'Create an Auto bookmarklet with your configuration built in, to give to a colleague.'],
};
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// docs/index.html (GitHub Pages installer) with a draggable link, a copy button and a SHA-256 per bookmarklet.
function installer(built) {
  const items = SCRIPTS.map(n => {
    const code = built[n], [title, text] = INFO[n];
    const sha = crypto.createHash('sha256').update(code).digest('hex');
    return [
      '  <div class="card">',
      '    <div class="row"><h3>' + title + '</h3><a class="bm" href="' + esc(code) + '">' + title + '</a>'
        + '<button class="primary" data-copy="code-' + n + '">Copy code</button></div>',
      '    <p class="muted">' + text + '</p>',
      '    <details><summary>View the code (' + code.length + ' characters)</summary><pre id="code-' + n + '">' + esc(code) + '</pre></details>',
      '    <div class="hash">SHA-256: ' + sha + '</div>',
      '  </div>',
    ].join('\n');
  }).join('\n');
  const tpl = fs.readFileSync(path.join(__dirname, 'installer.template.html'), 'utf8');
  fs.mkdirSync(path.join(root, 'docs', 'mock'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'index.html'), tpl.replace('{{ITEMS}}', () => items));
  fs.copyFileSync(path.join(root, 'mock', 'mock-oracle.html'), path.join(root, 'docs', 'mock', 'mock-oracle.html'));
  fs.writeFileSync(path.join(root, 'docs', '.nojekyll'), '');
  console.log('docs/index.html  (installer)');
}

(async () => {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const built = {};
  for (const n of SCRIPTS) {
    const code = built[n] = await buildOne(n, built);
    fs.writeFileSync(path.join(root, 'dist', n + '.txt'), code);
    console.log('dist/' + n + '.txt  ' + code.length + ' chars');
  }
  installer(built);
})().catch(e => { console.error('BUILD ERROR: ' + e.message); process.exit(1); });
