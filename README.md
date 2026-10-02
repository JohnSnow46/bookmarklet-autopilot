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
| **Learn** | Walks you through the process step by step. Ctrl+click remembers an element, a plain click works normally, so you can do the real process while teaching it. Warns ("Are you sure?") about a wrong element type, a duplicate pick, an ambiguous selector or an auto-generated-looking id, and shows a summary before saving. Has Back, Skip (optional steps) and Quit. At the end it asks what text to append and which list option to pick, so nothing is hard-coded. |
| **Auto** | Runs the process from the saved configuration: waits for elements, fills fields with real framework events, checks your validation rules, optionally asks "Save?", clicks Generate → Print, takes over the new tab and clicks Apply. Stops with the step and the reason when something is wrong, including an error message shown by the application after Save. |
| **Validate** | Same Ctrl+click idea for validation rules: *A equals B*, *A differs from B*, *A is not empty*, *A equals / contains a text*, *A matches a regex*. Each rule says when it runs: before Save, before Generate, or manual only. Works with any field, not only this process. |
| **Check** | Runs the "manual only" rules on the current page, on any page. |
| **Show** | Shows what has been learned: steps, texts, rules. |
| **Export** | Creates an Auto bookmarklet with your configuration built in (base64) and copies it to the clipboard (or shows it in a prompt). Give it to a colleague through an internal channel. |

### Validation rules in practice

Learn adds three default rules: the pasted line equals the copied line, the appended text is not empty,
a list value is chosen. Auto evaluates them right before Save; if one fails it stops and nothing is saved:

```
Auto stopped at "validation before Save": Validation failed, nothing was saved.
Rule 1 (equal): "line1" is "PCB-R10-MAIN rev.B" but "line2" is "PCB-R10-MAIN REV.B"
```

### Handing the setup to a colleague

Export leaves your personal list option out if you wish; the colleague is asked for their own on the first run and the
answer is remembered on their computer. The setup only works if their Oracle screen has the same layout and
element ids as yours (generated ids may differ, see the notes below).

### Notes on real-world pages

- **Iframes** of the same origin are supported: the frame path is stored with the selector. A cross-origin iframe cannot be reached by any bookmarklet.
- **Full page reloads** between steps kill the running script. Auto is built to continue from what it sees, so click it again after each reload.
- **Generated ids** (e.g. in ADF) may change between sessions. Learn warns about ids that look generated and stores a fallback selector from stable attributes (`name`, `aria-label`, …) that Auto uses when the id stops matching.
- **Error detection** after Save uses the element you may teach as the last Learn step plus a best-effort heuristic (`role=alert`, common error classes).

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
npm run build      # src/*.js  ->  dist/*.txt (one-line bookmarklets) + docs/index.html (installer)
npm run serve      # mock app at http://localhost:8000/mock/mock-oracle.html
npm test           # Playwright tests against the mock
```

The mock (`mock/mock-oracle.html`) imitates the process with Oracle-style ids, random delays, a
framework-like data model (only `input`/`change` events update it), a test panel with scannable codes and an event log.
Variants are selected with `?variant=…` (comma separated):

| Variant | Effect |
| --- | --- |
| `nolist` | no User list (tests optional steps) |
| `iframe` | the form lives in an iframe |
| `reload` | full page reload between steps |
| `mangle` | the "framework" upper-cases the pasted line (tests the rules) |
| `saveerror` | Save always fails with an application error |

## Using it at work

1. Open the installer page (below) or `docs/index.html` after a build.
2. Check first: a bookmark with the URL `javascript:alert('ok')` must show a dialog. If not, policy blocks bookmarklets - stop here.
3. Drag **Learn**, **Auto** (and the others you want) to the bookmarks bar, or press *Copy code* and paste the whole line into a new bookmark's URL field.
4. On the Oracle page click **Learn** and follow the bar at the top (Ctrl+click on each element).
5. Day to day: scan a code, click **Auto**, confirm the print dialog.

### Publishing the installer on GitHub Pages

The installer is `docs/index.html`, generated by `npm run build` together with a copy of the mock in `docs/mock/`.

1. Commit the build output (`dist/` and `docs/`) and push to `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch `main`, folder `/docs` → Save**.
3. After a minute the page is at `https://<user>.github.io/<repository>/`.

Or from the command line: `gh api -X POST repos/<user>/<repository>/pages -f "source[branch]=main" -f "source[path]=/docs"`.

The installer shows each bookmarklet as a draggable button, a *Copy code* button, a collapsible view of the code and its SHA-256.

## Repository layout

```
src/        common.js (shared helpers) + one file per bookmarklet
build/      build.js (sources -> one-line bookmarklets + installer), serve.js, installer.template.html
dist/       build output (committed, the installer uses it)
mock/       local mock of the process
tests/      Playwright tests that run the built bookmarklets against the mock
docs/       installer page for GitHub Pages (generated) and SECURITY.md
```

The build wraps `common.js` + a script in an IIFE, minifies it with terser and **fails** if the result contains
`#`, `%`, a newline, or any network/dynamic-code API (`fetch`, `XMLHttpRequest`, `eval`, …).

## Roadmap

- [x] 1. Skeleton, shared helpers, build with character checks, first end-to-end test
- [x] 2. Flexible learning steps (types, optional, Skip), configurable append text and list option
- [x] 3. Validation while learning (wrong element type, duplicates, ambiguous selectors, generated-looking ids, summary, fallback selectors)
- [x] 4. Generic validation rules (Validate, Check), error detection after Save
- [x] 5. Mock variants (iframe, reload, no list) and script support for them
- [x] 6. Show and Export (Auto with embedded configuration)
- [x] 7. Installer page for GitHub Pages
- [ ] Verified on the real Oracle application (only possible at work: ids, iframes, policy)

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model, the audit results and the checklist to review before use at work.
