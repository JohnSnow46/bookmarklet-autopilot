const STEPS = [
  ['search', 'pole wyszukiwania kodu'],
  ['searchBtn', 'przycisk Szukaj'],
  ['result', 'wynik wyszukiwania (produkt)'],
  ['line1', 'linię do skopiowania'],
  ['line2', 'pole, gdzie wklejasz'],
  ['line3', 'pole, gdzie dopisujesz'],
  ['user', 'listę Użytkownik'],
  ['save', 'przycisk Save'],
  ['gen', 'przycisk Generuj'],
  ['print', 'przycisk Print'],
  ['apply', 'przycisk Apply (w nowej karcie)'],
];
const K = 'autoLearn';
let st = JSON.parse(localStorage.getItem(K) || 'null');

if (st && st.i > 0 && st.i < STEPS.length) {
  if (!confirm('Kontynuować od kroku ' + (st.i + 1) + '? (Anuluj = od nowa)')) st = null;
} else if (st && st.i >= STEPS.length) {
  if (!confirm('Konfiguracja już jest. Uczyć od nowa?')) return;
  st = null;
}
if (!st) st = { i: 0, cfg: {} };

const old = document.getElementById('__naucz');
if (old) old.remove();
const b = document.createElement('div');
b.id = '__naucz';
b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgb(31,111,178);color:white;font:15px Arial;padding:10px 14px';
document.body.appendChild(b);

const store = () => {
  localStorage.setItem(K, JSON.stringify(st));
  if (st.i >= STEPS.length) localStorage.setItem('autoCfg', JSON.stringify(st.cfg));
};

const pick = e => {
  if (!e.ctrlKey || b.contains(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.type !== 'mousedown') return;
  const el = e.target.closest('button,a,input,select,textarea,[role=button]') || e.target;
  const tag = el.tagName.toLowerCase();
  st.cfg[STEPS[st.i][0]] = {
    sel: cssPath(el),
    text: ['input', 'select', 'textarea'].includes(tag) ? '' : el.textContent.trim(),
  };
  el.style.outline = '3px solid rgb(46,125,50)';
  setTimeout(() => { el.style.outline = ''; }, 800);
  st.i++;
  store();
  draw();
};

const off = () => {
  document.removeEventListener('mousedown', pick, true);
  document.removeEventListener('click', pick, true);
};

const mk = (t, f) => {
  const x = document.createElement('button');
  x.textContent = t;
  x.style.marginLeft = '10px';
  x.onclick = f;
  b.appendChild(x);
};

const draw = () => {
  if (st.i >= STEPS.length) {
    off();
    b.style.background = 'rgb(46,125,50)';
    b.innerHTML = '<b>Gotowe!</b> Zapamiętano wszystkie elementy. Możesz używać Auto.';
    setTimeout(() => b.remove(), 5000);
    return;
  }
  b.innerHTML = '<b>Naucz ' + (st.i + 1) + '/' + STEPS.length + ':</b> Ctrl+klik na: <u>' + STEPS[st.i][1] + '</u> (zwykły klik działa normalnie)';
  mk('Cofnij', () => { if (st.i > 0) { st.i--; store(); draw(); } });
  mk('Zakończ', () => { off(); b.remove(); });
};

document.addEventListener('mousedown', pick, true);
document.addEventListener('click', pick, true);
draw();
