# Security notes and audit

Scope: the bookmarklets in `src/`, the build in `build/`, the repository and its (planned) GitHub Pages installer.
Audit date: 2026-10-02, state after stage 2. Self-review by the author; not an independent penetration test.

## What the bookmarklets can and cannot do

A bookmarklet runs with **the full privileges of the page it is clicked on**. That is the whole point (it clicks and
types for you) and also the whole risk: the code you paste into a bookmark is trusted completely. Therefore:

- The code is short (a few KB) and readable in `src/`; reviewing it before use is realistic.
- It never talks to the network. The build **fails** if a bookmarklet contains `fetch`, `XMLHttpRequest`, `sendBeacon`,
  `WebSocket`, `EventSource`, `eval`, `new Function`, `importScripts`, `import(` or `document.cookie`.
- It has no runtime dependencies. `terser` and Playwright are build/test tools only and are not part of the output.
- It only reads/writes two `localStorage` keys on the page's own origin: `autoLearn` (learning state) and `autoCfg` (configuration).

## Data handling

| Item | Where it lives | Notes |
| --- | --- | --- |
| Selectors (element locations) | browser `localStorage`, per origin | Page structure, not content. Never committed. |
| Button captions (`Search`, `Save`, `Generate`, `Print`, `Apply`) | same | Needed to tell the Generate/Print states apart. |
| Appended text, list option name, "ask before Save" flag | same | Typed by the user at the end of learning. |
| Page content, product names, scanned codes | **not stored** | Fixed during the audit: Learn used to store the link text of the search result (a product name). It now stores captions only for the steps that need them. |

The configuration is not a secret, but it describes the structure of an internal system, so it must stay out of the repo
(`.gitignore` covers common export/capture file names) and out of public places. The planned Export bookmarklet will put the
configuration into the clipboard; treat that text like an internal document.

## Findings

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | Learn stored the visible text of every clicked element, including a product name from the results list. | Low (local only, but unnecessary data) | **Fixed** (text is stored only for caption-matched steps). |
| 2 | Nothing prevented a future change from adding network calls or dynamic code to a bookmarklet. | Medium (supply chain) | **Fixed**: build-time guard for forbidden APIs. |
| 3 | `window.open` is wrapped by Auto and restored on the first call. If the Print click never opens a tab, the wrapper stays until the page is reloaded. | Low | Accepted. Reload clears it; behaviour is limited to taking over one tab. |
| 4 | UI bar is built with `innerHTML`. | Info | Reviewed: only constant strings from the step table are interpolated, no page data. Keep it that way. |
| 5 | The new tab is accessed through `w.document`. | Info | Same-origin only; a cross-origin tab throws and is reported by an alert. No bypass is attempted. |
| 6 | Auto acts without a human looking at each step; a wrong learned element could save wrong data. | Medium (data quality) | Mitigated by the "Save?" confirmation (default on). Planned: learning validation (stage 3) and pre-Save rules (stage 4). Server-side validation in the application stays the authority. |
| 7 | The installer page (GitHub Pages) will hand out code that people paste into their browser. A compromised repo/account would mean malicious code. | Medium | Mitigations below. |
| 8 | `npm audit` | - | 0 known vulnerabilities (dev dependencies only). |
| 9 | Git history: author identity is the GitHub no-reply address; no secrets, tokens or company data found. | - | Clean. |

## Supply-chain mitigations (for the installer, stage 7)

- Publish the SHA-256 of every `dist/*.txt` next to the copy button so anyone can verify what they paste.
- Tag releases and point the installer at a tag/commit, not at a moving branch.
- Enable two-factor authentication and branch protection on the GitHub repository.
- Colleagues should copy the code once and keep working from their own bookmark; they should not re-copy blindly after updates without reading the changelog.

## Organisational points (not technical)

- A bookmarklet works only if IT policy allows `javascript:` URLs. If it is blocked, that is a decision, not a bug. **Do not look for workarounds.**
- Automating clicks in a corporate application may be covered by an acceptable-use or automation policy even if it is technically possible.
  Get explicit approval from the manager and, ideally, IT/security before relying on it. Be able to show what the code does.
- Automated actions appear in the application's audit log under your account. You remain responsible for what is saved.
- No company data may be put into this repository, including issues, screenshots and pull requests.

## Pre-use checklist

- [ ] Read `src/*.js` (or the built `dist/*.txt`) and confirm it only touches the page and `localStorage`.
- [ ] Verify the SHA-256 of what you pasted against the published value.
- [ ] Confirm approval from your manager / IT for this kind of automation.
- [ ] Teach on a harmless record first; keep "Save?" confirmation on until you trust the setup.
- [ ] Never commit or post a configuration export from the real application.
