const C = { extraLine: 'Dopisana linia (test)', user: 'Ty (test)', confirmSave: true };
const cfg = JSON.parse(localStorage.getItem('autoCfg') || 'null');
if (!cfg) { alert('Najpierw uruchom zakładkę Naucz.'); return; }

const fnd = (k, d) => find(cfg, k, d);
const need = k => {
  const e = fnd(k);
  if (!e) throw new Error('Nie widzę elementu: ' + k);
  return e;
};

(async () => {
  try {
    const s = fnd('search');
    if (!s || !s.value.trim()) throw new Error('Najpierw zeskanuj kod do pola wyszukiwania.');
    (await waitFor(() => fnd('searchBtn'), 'przycisk Szukaj')).click();
    (await waitFor(() => fnd('result'), 'wynik wyszukiwania')).click();
    const l1 = await waitFor(() => fnd('line1'), 'formularz');
    setVal(need('line2'), l1.value);
    setVal(need('line3'), C.extraLine);
    const sel = need('user');
    const o = [...sel.options].find(x => x.text.trim() === C.user);
    if (!o) throw new Error('Brak użytkownika: ' + C.user);
    setVal(sel, o.value);
    if (C.confirmSave && !confirm('Zapisać?')) return;
    need('save').click();
    (await waitFor(() => fnd('gen'), 'przycisk Generuj')).click();
    const pb = await waitFor(() => fnd('print'), 'przycisk Print', 30000);
    const oo = window.open;
    window.open = function (...a) {
      window.open = oo;
      const w = oo.apply(window, a);
      if (!w) { alert('Przeglądarka zablokowała nową kartę. Zezwól na wyskakujące okna.'); return w; }
      waitFor(() => fnd('apply', w.document), 'Apply w nowej karcie', 30000)
        .then(x => x.click())
        .catch(e => alert('Karta wydruku: ' + e.message));
      return w;
    };
    pb.click();
  } catch (e) { alert('Automat: ' + e.message); }
})();
