// Źródła (src/*.js) → jednolinijkowe bookmarklety w dist/*.txt
const fs = require('fs'), path = require('path');
const { minify } = require('terser');

const root = path.join(__dirname, '..');
const SCRIPTS = ['naucz', 'auto'];

function check(name, code) {
  const bad = [];
  if (code.includes('#')) bad.push('znak #');
  if (code.includes('%')) bad.push('znak %');
  if (/[\r\n]/.test(code)) bad.push('znak nowej linii');
  if (!code.startsWith('javascript:')) bad.push('brak prefiksu javascript:');
  if (bad.length) throw new Error('Bookmarklet "' + name + '" jest niepoprawny: ' + bad.join(', '));
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
    console.log('dist/' + n + '.txt  ' + code.length + ' znaków');
  }
})().catch(e => { console.error('BŁĄD BUILDU: ' + e.message); process.exit(1); });
