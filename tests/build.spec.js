const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { check, buildAll, SCRIPTS } = require('../build/build');

const ok = 'javascript:(()=>{alert(1)})();';
const bad = code => { try { check('t', code); return ''; } catch (e) { return e.message; } };

test('the build guard accepts a plain bookmarklet', () => {
  expect(bad(ok)).toBe('');
});

test('the build guard rejects network access, dynamic code, loaders and unsafe characters', () => {
  for (const [code, why] of [
    ['javascript:fetch("x")', 'forbidden API: fetch'],
    ['javascript:new XMLHttpRequest()', 'forbidden API: XMLHttpRequest'],
    ['javascript:navigator.sendBeacon("x")', 'forbidden API: sendBeacon'],
    ['javascript:eval("1")', 'forbidden API: eval'],
    ['javascript:new Function("1")', 'forbidden API: new Function'],
    ['javascript:import("x")', 'forbidden API: import('],
    ['javascript:new Worker("x")', 'forbidden API: Worker'],
    ['javascript:new Image', 'forbidden API: new Image'],
    ['javascript:document.createElement("script")', 'forbidden API: createElement("script")'],
    ["javascript:document.createElement('img')", "forbidden API: createElement('img')"],
    ['javascript:location.href="x"', 'forbidden API: .href='],
    ['javascript:top.postMessage(1)', 'forbidden API: postMessage'],
    ['javascript:document.cookie', 'forbidden API: document.cookie'],
    ['javascript:Function("x")()', 'Function('],
    ['javascript:location="//x"', 'forbidden API: location='],
    ['javascript:setTimeout("x()",1)', 'forbidden API: setTimeout("'],
    ['javascript:el.innerHTML="<img src=x>"', 'forbidden API: <img'],
    ['javascript:window["ev"+"al"]', 'forbidden API: ["ev"+'],
    ['javascript:f.submit()', 'forbidden API: .submit()'],
    ['javascript:s.background="url(x)"', 'forbidden API: url('],
    ['javascript:a("__PLAY__")', 'a placeholder the build did not fill'],
    ['javascript:x="a#b"', 'a hash character'],
    ['javascript:x="50%"', 'a percent character'],
    ['javascript:x=1\ny=2', 'a newline'],
    ['alert(1)', 'missing javascript: prefix'],
  ]) expect(bad(code), code).toContain(why);
});

test('dist/ is exactly what the sources build to, and passes the guard', async () => {
  const built = await buildAll();
  for (const n of SCRIPTS) {
    expect(fs.readFileSync(path.join(__dirname, '..', 'dist', n + '.txt'), 'utf8'), n + ' is stale: run npm run build').toBe(built[n]);
    expect(bad(built[n]), n).toBe('');
  }
});
