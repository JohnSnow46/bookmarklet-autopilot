# Security notes and audit

Scope: the bookmarklets in `src/`, the build in `build/`, the repository and the GitHub Pages installer.
Audit date: 2026-10-02, state after the last roadmap stage. Self-review by the author; not an independent penetration test.

## What the bookmarklets can and cannot do

A bookmarklet runs with **the full rights of the page it is clicked on**. That is the whole point (it clicks and
types for you) and also the whole risk: the code you paste into a bookmark is trusted completely. Therefore:

- The code is short (1-7 KB per bookmarklet) and readable in `src/`; reviewing it before use is realistic.
- It never talks to the network. The build **fails** if a bookmarklet contains `fetch`, `XMLHttpRequest`, `sendBeacon`,
  `WebSocket`, `EventSource`, `eval`, `new Function`, `importScripts`, `import(` or `document.cookie`.
- It has no runtime dependencies. `terser` and Playwright are build/test tools only and are not part of the output.
- It reads and writes only `localStorage` keys on the page's own origin: `autoLearn` (learning state), `autoCfg`
  (configuration and rules) and `autoUserOption` (the list option a colleague typed on the first run of an exported Auto).
- The only other effects are clicks, typing into fields, the "Save?" question, alerts/prompts, and (Export) one clipboard write.

## Data handling

| Item | Where it lives | Notes |
| --- | --- | --- |
| Selectors, frame paths, fallback selectors | browser `localStorage`, per origin | Page structure, not content. Never committed. |
| Button captions (`Search`, `Save`, `Generate`, `Print`, `Apply`) | same | Needed to tell the Generate/Print states apart. |
| Field labels of rule fields (e.g. a `<label>` text) | same, in `autoCfg.rules` | UI captions, not record data. |
| Appended text, list option name, "ask before Save" flag | same | Typed by the user at the end of learning. |
| Values of fields | **shown** in the failure message of a rule (an alert on your screen) | Never stored or sent. |
| Page content, product names, scanned codes | **not stored** | Learn only keeps captions for the steps that need them. |

The configuration is not a secret, but it describes the structure of an internal system, so it must stay out of the repo
(`.gitignore` covers common export/capture file names) and out of public places. **Export puts the configuration
into the clipboard and into the exported code as base64. Base64 is encoding, not encryption**: anyone holding the code
can read the configuration. Share it only through internal channels.

## Findings

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | Learn stored the visible text of every clicked element, including a product name from the results list. | Low (local only, but unnecessary data) | **Fixed** (text is stored only for caption-matched steps). |
| 2 | Nothing prevented a future change from adding network calls or dynamic code to a bookmarklet. | Medium (supply chain) | **Fixed**: build-time guard for forbidden APIs, also covered by a test on `dist/`. |
| 3 | `window.open` is wrapped by Auto and restored on the first call. If the Print click never opens a tab, the wrapper stays until the page is reloaded. | Low | Accepted. Reload clears it; behaviour is limited to taking over one tab. |
| 4 | The Learn/Validate bars are built with `innerHTML`. | Info | Reviewed: only constant strings are interpolated, no page data. Keep it that way. |
| 5 | Frames and the print tab are accessed through `contentDocument` / `w.document`. | Info | Same-origin only; a cross-origin frame or tab is simply not reachable and Auto reports what it could not find. No bypass is attempted. |
| 6 | Auto acts without a human looking at each step; a wrong learned element could save wrong data. | Medium (data quality) | Mitigated: "Save?" confirmation (default on), validation while learning, validation rules before Save/Generate, error detection after Save. Server-side validation in the application stays the authority. |
| 7 | The installer page hands out code that people paste into their browser. A compromised repository or account would mean malicious code. | Medium | Mitigated: SHA-256 and a readable copy of each bookmarklet are shown on the page; see the owner's tasks below. |
| 8 | `npm audit` | - | 0 known vulnerabilities (dev dependencies only). |
| 9 | Git history: author identity is the GitHub no-reply address; no secrets, tokens or company data found. | - | Clean. |
| 10 | Export embeds the configuration as base64 in a code string that gets pasted and sent around. | Low | Documented above; Export asks whether to leave out the personal list option. |
| 11 | The error heuristic (`role=alert`, `.error`, ...) can match an unrelated visible element. | Low | Auto only reacts to texts that were **not** visible before Save, and the learned error element has priority. A false positive stops Auto (safe direction). |
| 12 | The "looks auto-generated" id check is a heuristic. | Info | Only a warning; the fallback selector reduces the impact. |

## Owner's tasks for the installer

- Tag releases and give colleagues the tag URL, not a moving branch.
- Enable two-factor authentication on the GitHub account and branch protection on `main`.
- Colleagues should copy the code once and keep working from their own bookmark; they should not re-copy blindly after updates without reading the changelog.
- Re-run `npm run build` and `npm test` before every push: the installer and `dist/` are generated and tested together.

## Organisational points (not technical)

- A bookmarklet works only if IT policy allows `javascript:` URLs. If it is blocked, that is a decision, not a bug. **Do not look for workarounds.**
- Automating clicks in a corporate application may be covered by an acceptable-use or automation policy even if it is technically possible.
  Get explicit approval from the manager and, ideally, IT/security before relying on it. Be able to show what the code does.
- Automated actions appear in the application's audit log under your account. You remain responsible for what is saved.
- No company data may be put into this repository, including issues, screenshots and pull requests.

## Pre-use checklist

- [ ] Read `src/*.js` (or the built `dist/*.txt`) and confirm it only touches the page and `localStorage`.
- [ ] Compare the SHA-256 shown by the installer with `dist/*.txt` of the tagged release.
- [ ] Confirm approval from your manager / IT for this kind of automation.
- [ ] Teach on a harmless record first; keep the "Save?" confirmation on until you trust the setup.
- [ ] Never commit or post a configuration export from the real application.
