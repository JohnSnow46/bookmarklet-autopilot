# Oracle Bookmarklets

Automate the repetitive "scan → search → fill → save → print" routine in a web-based Oracle app,
using nothing but **Chrome bookmarks**. No extensions, no installs, no admin rights.

> You scan a barcode, click one bookmark, and confirm the system print dialog. Everything in between is automated.

```
 scan code ─▶ Search ─▶ pick product ─▶ copy line ─▶ paste + append ─▶ Save ─▶ Generate ─▶ Print ─▶ Apply ─▶ (you confirm printing)
              └──────────────────────── one click on the "Auto" bookmark ────────────────────────┘
```

## Why bookmarklets

A bookmarklet is a bookmark whose URL is `javascript:…` code. It runs inside the page you are on,
so it needs no installation and works on locked-down machines where extensions are not allowed.

Because the real page markup must never leave the company, the scripts **do not contain any selectors**.
Instead, you *teach* them once on the live page: Ctrl+click an element and its location is remembered
in the browser's own `localStorage`. Nothing is sent anywhere.

## The bookmarklets

| Name | What it does |
| --- | --- |
| **Learn** | Walks you through the process step by step. Ctrl+click remembers an element, a plain click works normally. Has Back, Skip (optional steps) and Quit. At the end it asks what text to append and which list option to pick, so nothing is hard-coded. |
| **Auto** | Runs the whole process from the saved configuration: waits for elements, fills fields with real framework events, optionally asks "Save?", clicks Generate → Print, takes over the new tab and clicks Apply. |
| **Validate** *(planned)* | Same Ctrl+click idea, but for rules ("field A equals field B", "not empty", …) that Auto checks before saving. |
| **Show / Export** *(planned)* | Show the saved configuration; export an Auto bookmarklet with the configuration embedded. |

## Hard constraints (by design)

- Bookmarklets only. No extension, no program, no Python on the work computer.
- Every bookmarklet is **one line** starting with `javascript:`, with no `#` and no `%` in the code.
- No company data in this repository: no HTML, screenshots, product names or exported configs (see `.gitignore`).
- Values are set with the native `value` setter plus `input` and `change` events, so frameworks notice them.
- The print page opens in a new tab; Auto takes it over by wrapping `window.open`. Pop-ups must be allowed.
- The system print dialog stays manual. JavaScript cannot (and should not) confirm it.
- If IT policy blocks bookmarklets, the project simply does not work there. There is no workaround and none is sought.

## Quick start (local, on the mock)

You need Node.js 20+.

```bash
npm install
npx playwright install chromium
npm run build      # src/*.js  ->  dist/*.txt (one-line bookmarklets)
npm run serve      # mock app at http://localhost:8000/mock/mock-oracle.html
npm test           # Playwright tests against the mock
```

The mock (`mock/mock-oracle.html`) imitates the process with Oracle-style ids, random delays, a
framework-like data model (only `input`/`change` events update it), a test panel with scannable codes and an event log.
Variants are selected with `?variant=…`, e.g. `?variant=nolist` removes the User list.

## Using it at work

1. Run `npm run build` and open `dist/learn.txt` / `dist/auto.txt` (the installer page for GitHub Pages is on the roadmap).
2. In Chrome create a bookmark, and paste the **whole line** into the URL field.
3. Sanity check first: a bookmark with the URL `javascript:alert('ok')` must show a dialog. If not, policy blocks bookmarklets - stop here.
4. On the Oracle page, click **Learn** and follow the bar at the top (Ctrl+click on each element).
5. Day to day: scan a code, click **Auto**, confirm the print dialog.

## Repository layout

```
src/        common.js (shared helpers) + one file per bookmarklet
build/      build.js (sources -> one-line bookmarklets), serve.js (static server)
dist/       build output (committed, the installer uses it)
mock/       local mock of the process
tests/      Playwright tests that run the built bookmarklets against the mock
docs/       installer page for GitHub Pages (planned) and security notes
```

The build wraps `common.js` + a script in an IIFE, minifies it with terser and **fails** if the result contains
`#`, `%`, a newline, or any network/dynamic-code API (`fetch`, `XMLHttpRequest`, `eval`, …).

## Roadmap

- [x] 1. Skeleton, shared helpers, build with character checks, first end-to-end test
- [x] 2. Flexible learning steps (types, optional, Skip), configurable append text and list option
- [ ] 3. Validation while learning (wrong element type, duplicates, ambiguous selectors, summary)
- [ ] 4. Generic validation rules (Ctrl+click picks the fields) and error detection after Save
- [ ] 5. Mock variants: iframe, full page reload; script support for them
- [ ] 6. Show and Export (Auto with embedded configuration)
- [ ] 7. Installer page for GitHub Pages

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model, the audit results and the checklist to review before use at work.
