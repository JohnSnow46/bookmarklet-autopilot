// Sources (src/*.js) → one-line bookmarklets in dist/*.txt
const fs = require('fs'), path = require('path');
const { minify } = require('terser');

const root = path.join(__dirname, '..');
const SCRIPTS = ['learn', 'auto'];

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

async function buildOne(name) {
  const common = fs.readFileSync(path.join(root, 'src', 'common.js'), 'utf8');
  const body = fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8');
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

(async () => {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  for (const n of SCRIPTS) {
    const code = await buildOne(n);
    fs.writeFileSync(path.join(root, 'dist', n + '.txt'), code);
    console.log('dist/' + n + '.txt  ' + code.length + ' chars');
  }
})().catch(e => { console.error('BUILD ERROR: ' + e.message); process.exit(1); });
