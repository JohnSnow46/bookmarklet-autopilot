// Sources (src/*.js) → one-line bookmarklets in dist/*.txt
const fs = require('fs'), path = require('path');
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

(async () => {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const built = {};
  for (const n of SCRIPTS) {
    const code = built[n] = await buildOne(n, built);
    fs.writeFileSync(path.join(root, 'dist', n + '.txt'), code);
    console.log('dist/' + n + '.txt  ' + code.length + ' chars');
  }
})().catch(e => { console.error('BUILD ERROR: ' + e.message); process.exit(1); });
