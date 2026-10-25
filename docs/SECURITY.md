# Security notes and audit

Scope: the bookmarklets in `src/`, the build in `build/`, the repository and the GitHub Pages installer.
Audit date: 2026-10-02, state after the last roadmap stage. Self-review by the author; not an independent penetration test.

## What the bookmarklets can and cannot do

A bookmarklet runs with **the full rights of the page it is clicked on**. That is the whole point (it clicks and
types for you) and also the whole risk: the code you paste into a bookmark is trusted completely. Therefore:

- The code is short (1-7 KB per bookmarklet) and readable in `src/`; reviewing it before use is realistic.
- It never talks to the network. The build **fails** if a bookmarklet contains `fetch`, `XMLHttpRequest`, `sendBeacon`,
  `WebSocket`, `EventSource`, `eval`, `new Function`, `importScripts`, `import(`, `document.cookie`, workers,
  `postMessage`, `srcdoc`, `document.write`, `new Image`, navigation (`.href=`, `location.assign/replace`), creation of
  elements that load a URL (`script`, `iframe`, `img`, `link`, `object`, `embed`, media, `style`), or a build placeholder
  that was not filled. A test checks the guard itself and that `dist/` matches a fresh build of `src/`.
- It has no runtime dependencies. `terser` and Playwright are build/test tools only and are not part of the output.
- Record never records password or hidden fields; typed values of other fields stay in the recording (they are what Play types), which is why Export lists them first.
- It reads and writes only `localStorage` keys on the page's own origin: `autoLearn` (learning state), `autoCfg`
  (configuration and rules) and `autoRec` (the recording in progress, emptied when saved), `autoLog` (run log: time, duration, result, step described without typed or chosen texts - no codes, products or people; last 500 runs; *Show* can clear it), `playState` (sessionStorage: step counter of a running Play, the profile in use, the last clicked "Save?" step and a hash of the recording; removed when the run ends), `playUncertain` (sessionStorage: time, step number and recording hash of a Save that a run clicked before it stopped; no values), `autoProfiles` and `autoProfileIdx` (the name/organization a person typed or chose on this computer).
- Every read of this storage tolerates blocked storage and damaged data: the bookmarklet reports it and does nothing, it does not fail half-way. Other scripts of the same origin can read and change these keys, so a configuration is checked for shape before Play acts on it, and an unknown or newer version is refused.
- Besides `localStorage`, the bookmarklets set one page global, `window.__autopilotRun`, which holds the name of the running Play/Series/Auto so that a second click is refused.
- The only other effects are clicks, typing into fields, the "Save?" question, alerts/prompts, and (Export) one clipboard write.

## Data handling

| Item | Where it lives | Notes |
| --- | --- | --- |
| Selectors, frame paths, fallback selectors | browser `localStorage`, per origin | Page structure, not content. Never committed. |
| Button captions (`Search`, `Save`, `Generate`, `Print`, `Apply`) | same | Needed to tell the Generate/Print states apart. |
| Field labels of rule fields (e.g. a `<label>` text) | same, in `autoCfg.rules` | UI captions, not record data. |
| Appended text, profiles (name, organization), "ask before Save" flag | same | Typed by the user. A name is personal data: it stays in the browser, is included in an export only if you agree, and never goes to the repository. |
| Values of fields | **shown** in the failure message of a rule (an alert on your screen) | Never stored or sent. |
| Page content, product names, scanned codes | **not stored** | Learn only keeps captions for the steps that need them. |

The configuration is not a secret, but it describes the structure of the application it was made on, so keep it out of the repo
(`.gitignore` covers common export/capture file names) and out of public places. **Export puts the configuration
into the clipboard and into the exported code as base64. Base64 is encoding, not encryption**: anyone holding the code
can read the configuration. Share it only with people who should see it.

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
| 9 | Git history: author identity is the GitHub no-reply address; no secrets, tokens or application data found. | - | Clean. |
| 10 | Export embeds the configuration as base64 in a code string that gets pasted and sent around. | Low | Documented above; Export asks whether to leave out the personal list option. |
| 11 | The error heuristic (`role=alert`, `.error`, ...) can match an unrelated visible element. | Low | Auto only reacts to texts that were **not** visible before Save, and the learned error element has priority. A false positive stops Auto (safe direction). |
| 12 | The "looks auto-generated" id check is a heuristic. | Info | Only a warning; the fallback selector reduces the impact. |
| 14 | Validate put page-derived text (field labels) into the bar through `innerHTML`: a page controlling a label could inject markup into the bar. | Low (the page can already run script; matters under Trusted Types/strict CSP) | **Fixed**: text nodes only; regression test with a hostile label. |
| 15 | Record stored typed values of every text field, including password fields. | Medium (credentials in localStorage) | **Fixed**: password and hidden fields are never recorded; the bar says so. Test checks that the secret is nowhere in localStorage. |
| 16 | Record stored the text of picked list rows (product names, people) and the raw recording stayed in localStorage. | Medium (application data in storage and exports) | **Fixed**: row/list texts are kept only for a fixed choice; for *the only row / your name / your organization* they are dropped, and the raw recording (`autoRec`) is emptied after saving. |
| 17 | Export put fixed texts of the recording in the exported code without showing them. | Low-Medium | **Fixed**: Export lists every fixed text and the append text and asks before copying; Cancel copies nothing. |
| 18 | Dry run must never change data. | - | By design: it only locates and outlines elements; a test checks that no field is typed into and nothing is clicked. |
| 13 | Selecting a person in a searchable list could pick the wrong person (same name, two organizations). | Medium (data quality) | Mitigated: exactly one matching row is required, otherwise Auto stops, lists the rows and selects nothing. |

Second review, 2026-10-25 (reliability and data safety):

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 19 | Two Play/Auto runs could work on the same page at once (double click, Play during Series), each asking "Save?" and saving. | Medium (duplicate data) | **Fixed**: one run per page (`window.__autopilotRun`); a second click is refused. Test. |
| 20 | After a Save was clicked and the run then stopped, or a reload after Save was not continued within 60 s, the next Play started from step 1 and could save the same data again, without a word. | Medium (duplicate data) | **Fixed**: the clicked "Save?" step is remembered per tab; the stop message says the data may already be saved, and the next Play/Series asks before starting over. Nothing is retried automatically. Tests for both paths. Limitation: sessionStorage is per tab, so a new tab does not know about it. |
| 21 | The fallback selector was taken with `querySelector`, i.e. the first of several matches once it was no longer unique. | Medium (wrong element) | **Fixed**: the fallback is used only while it matches exactly one element; Play and Dry run say when it is ambiguous. Test. |
| 22 | Damaged or blocked `localStorage` made bookmarklets throw before showing anything; a failing log write could hide the stop message. | Low-Medium (silent failure) | **Fixed**: all storage access goes through helpers that never throw; damaged, unreadable or newer-version configurations are reported. Tests. |
| 23 | A malformed or hand-edited recording (embedded or stored) could fail with a script error after some steps were already done. | Low-Medium | **Fixed**: Play checks the shape of every step before the first one. Test. |
| 24 | The run log stored the step text including fixed typed texts and fixed list choices. | Low (data minimisation) | **Fixed**: the log describes steps without values; the on-screen message still shows them. Test. |
| 25 | The resume state matched a recording only by its number of steps. | Low | **Fixed**: the state carries a hash of the recording. |
| 26 | The build guard did not cover workers, `postMessage`, navigation or elements that load URLs; `dist/` could be stale against `src/` while tests passed. | Low (supply chain) | **Fixed**: wider guard, `pretest` rebuild and a test that compares `dist/` with a fresh build. |
| 28 | Review by the `code-reviewer` agent and exploratory testing by the Playwright planner agent found: a false "Done" after a reload-causing last step; row texts back in the log; the Save warning expiring after 30 min; Save-like clicks without "Save?" unguarded; no guard with blocked storage; the print tab inheriting the run state; an empty organization matching any row. | Medium | **Fixed**, each with a regression test. |
| 29 | A step that waits for a button which only appears after a page refresh could not be continued after Play gave up: the only way on was a restart from step 1. | Medium (duplicate data, usability) | **Fixed**: a run that stops while waiting after a Save-like click is parked in `playState` (sessionStorage) and continues at that step after a confirmation; it never repeats what was done. |
| 30 | Second review and test pass: damaged entries inside stored lists (log, recording in progress, profiles) made Show, Record or Play fail; the build guard missed `Function(`, `location=`, string timers, `url(`, `.submit()` and injected tags; Dry run removed an outline the page had set; Esc was taken from the page itself and from iframes inconsistently; Record recorded what Play typed and split recordings across tabs. | Low-Medium | **Fixed**, each with a regression test. The build guard is a tripwire against accidental additions, not a sandbox: a reviewer still reads every change. |
| 27 | Exported bookmarklets made before this review keep their old built-in Play code. | Info | Accepted: the configuration format is unchanged (v4), so re-exporting gives the new behaviour. |

## Owner's tasks for the installer

- Tag releases and point users to the tag URL, not a moving branch.
- Enable two-factor authentication on the GitHub account and branch protection on `main`.
- Users should copy the code once and keep working from their own bookmark; they should not re-copy blindly after updates without reading the changelog.
- Re-run `npm run build` and `npm test` before every push: the installer and `dist/` are generated and tested together.

## Responsible use

- A bookmarklet works only if the browser allows `javascript:` URLs. Some managed browsers disable them; then the project does not work there and no workaround is attempted.
- Automate only applications you are allowed to automate, and respect their terms of use. Be able to show what the code does.
- Automated actions are made under your account. You remain responsible for what is saved.
- Never put real application data into this repository, including issues, screenshots and pull requests.

## Pre-use checklist

- [ ] Read `src/*.js` (or the built `dist/*.txt`) and confirm it only touches the page and `localStorage`.
- [ ] Compare the SHA-256 shown by the installer with `dist/*.txt` of the tagged release.
- [ ] Start with Dry run, then a harmless record; keep the "Save?" confirmation on until you trust the setup.
- [ ] Never commit or post a configuration export from a real application.
