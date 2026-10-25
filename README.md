# Bookmarklet Autopilot

## Quick instructions (5 minutes)

**Once: install**

1. Open <https://johnsnow46.github.io/bookmarklet-autopilot/>
2. Turn on the bookmarks bar: press **Ctrl+Shift+B**.
3. Drag the **Record**, **Play** and **Dry run** buttons onto the bookmarks bar.
4. Check it works: if your application opens new tabs (e.g. for printing), allow **pop-ups** for its address in the browser.

**Once: record what you do**

1. Open your application, on the screen where your work starts.
2. Click **Record** in the bookmarks bar. A red bar appears at the top.
3. Do your work **once**, normally, until the end. **Type or scan** the code yourself (do not pick it from a list of codes; in the demo, do not use the code buttons of its Test panel): that is how Play knows what changes every time.
   - Does your work open a **new tab** (e.g. a print preview)? Click **Record** again in that new tab and carry on there.
   - Did the page **reload completely**? Click **Record** again and press **OK** to continue the recording.
4. Click **Stop and review** on the red bar, in the **last** tab you worked in.
5. Questions appear. If you are not sure, just press **OK** each time.
6. A green bar says **Done!**. The recording is saved.

**Every time: let it work for you**

1. Type or scan the next code.
2. Click **Play**.
3. When it asks **Save?**, look at the form. Correct? Press **OK**. Something wrong? Press **Cancel**.
4. Done. Go back to the **first tab**, go back to the screen with the code field (in the demo: **New scan**), enter the next code, **Play** again.
5. The page reloaded completely while Play was working? Click **Play** again within a minute: it carries on where it was.

**Need the button that only appears after a refresh?** (e.g. **Print** after a document is generated)

Play waits, then stops and says **"continue at step N"**. Refresh the page (F5) until the button is there, click **Play** and press **OK** to continue: it carries on at that step and does **not** save again. Fields it filled in after the last click are filled in again, because the refresh empties them.

**If something goes wrong**

- Play stops and shows a message saying **which step** and **why**. Do that step by hand, or record again.
- Want to stop it? Press **Esc** or **Cancel** on the blue bar (in Series: **Stop**).
- You pressed **Cancel** at **Save?**: nothing was saved by that step. Fix the form by hand and click Save yourself, or go back to the code field and start again.
- Nothing happens at all when you click a bookmark? Your browser may block it on that page: try the demo first, from the address above.
- The message says Save **"was already clicked"**? Check in the application whether it was saved **before** you click Play again.
- Not sure whether it will work on this screen? Click **Dry run**. It only checks, it clicks nothing.

Want screenshots? See the [step-by-step guide](docs/GUIDE.md).

---

Record a repetitive routine in any web application once, then replay it with one click, using nothing but
**browser bookmarks**. No extensions, no installs, no admin rights, nothing leaves the browser.

> Enter the input (type it or scan a barcode), click one bookmark, and the clicks, typing and list choices of your routine are done for you.

```
 input ─▶ search ─▶ pick a row ─▶ copy a value ─▶ fill fields ─▶ Save ─▶ … ─▶ new tab ─▶ Apply
          └──────────────────────────── one click on the "Play" bookmark ─────────────────────────┘
```

Typical uses: data entry that repeats the same screens for every item, look-up-and-copy chores, label or document
printing flows, anything where you click through the same form many times a day.

**New here?** Follow the [step-by-step guide with screenshots](docs/GUIDE.md).

## Why bookmarklets

A bookmarklet is a bookmark whose URL is `javascript:…` code. It runs inside the page you are on,
so it needs no installation and works where browser extensions are not an option.

The scripts **contain no selectors for any particular site**. You *teach* them on the live page, by recording the
routine or by Ctrl+clicking elements, and what they learn is stored in the browser's own `localStorage`. Nothing is
sent anywhere.

## The easy way: Record and Play

No step-by-step teaching. Click **Record**, do the routine **once, normally** (including Apply in a new tab, if your
routine opens one) and press *Stop and review*. Record notes every click, typed value and choice, and then asks a few
short questions:

- which steps to remove (a slip, a wrong click);
- for each list choice: *always this one*, *the only row shown* (changes with every input), *your name* or *your organization*;
- before which steps to ask "Save?" (Save buttons are suggested; an empty answer accepts the suggestion).

Then enter an input and click **Play**. It repeats the recording, copies fields that were copied while recording, takes
over the new tab, and stops with the step and the reason if something differs (a field that does not keep its value, a
row that is missing or ambiguous, an error shown by the application after Save). When it gives up waiting for an
element it says why: not on this screen, hidden, disabled, another caption, an iframe it cannot reach, or a fallback
selector that now matches several elements (it never takes the first of several). While it works a bar shows the
current step; **Cancel** (or **Esc**) stops it before the next step or while it waits. A click that was already sent is
never undone.

Play is careful with Save:

- Validation rules (Validate) are checked by Play too: *before Save* before the step that saves (the first step that asks "Save?", else the first Save-like click), *before Generate* before the first click after that step. A recording where Play could not tell where that is is refused, never run without the rules.
- Links and list rows count as well: a "Delete" or "Approve" link in a table row can ask "Save?" and is never repeated without asking. Of a link caption only that word is kept, not the names or numbers next to it.
- Only one Play, Series or Auto runs on a page at a time; a second click is refused, so nothing is saved twice in parallel.
- If a Save-like step (one that asks "Save?", or whose caption looks like save, submit, send, delete, …) was clicked
  and the run then stopped, was cancelled, or a page reload after it was not continued within a minute, the stop
  message says the data **may already be saved**, and the next Play or Series in that tab explains this and asks before
  starting again from step 1. It never repeats a Save on its own.
- **A button that only appears after a refresh** (e.g. Print, while the printout is generated in the background): when
  Play stops waiting for it after Save, it remembers that step. Refresh the page as often as needed, click Play, answer
  **OK = continue at step N**, and it goes on from there without saving again. If you refresh while Play is still
  waiting and click Play within a minute, it continues without asking.
- A recording or configuration that is damaged, malformed or made by a newer version is refused before the first step,
  with the reason; nothing is clicked.

**Export** turns a recording into a
Play bookmarklet with the recording built in, to share or to use on another computer (the name and organization of
whoever runs it are asked on first use).

Three helpers built from the same Play code:

- **Dry run** - the safe first test. It checks which recorded steps it can find *on the screen as it is now*,
  highlights them, and reports `OK` / `not on this screen` / `found, but hidden` (or disabled, or with another caption)
  per step, plus the current state of the rules. It clicks and types nothing. Run it on each screen of the routine.
- **Series** - many items in a row. Click it once; it waits for an input, runs, waits for the next one (go back to the screen with the code field yourself, e.g. *New scan*), runs again,
  until you press *Stop* on its bar (Stop also stops a run that is under way). An input counts once it has finished being typed (a barcode scanner types very
  fast); after a run the field has to be empty again (or gone) first, so two identical inputs one after another are
  two items. Full page reloads end a series (the script dies with the page): use Play there.
- **Run log** - Play and Series append each run to a log on this computer: time, duration, result (completed / stopped /
  cancelled) and the step where it stopped, **without inputs, typed texts, field values or people** (a step is logged as
  e.g. `step 5 (type a fixed text into "Line 3")`). *Show* summarises it
  (runs today, average time of a completed run, where runs stop most often), so you can see how much time it saves.

Learn and Auto below remain as the advanced, fully controlled variant.

## The bookmarklets

| Name | What it does |
| --- | --- |
| **Record** / **Play** | See above. Record needs no teaching steps; Play repeats what was recorded. Recordings are stored in the same `localStorage` as everything else and never leave the browser. |
| **Series** / **Dry run** | Play for many items in a row / a check that clicks nothing. See above. |
| **Learn** | Teaches a fixed *lookup → copy → fill → save → print* workflow step by step. Ctrl+click remembers an element, a plain click works normally, so you can do the real routine while teaching it. Warns ("Are you sure?") about a wrong element type, a duplicate pick, an ambiguous selector or an auto-generated-looking id, and shows a summary before saving. Has Back, Skip (optional steps) and Quit. At the end it asks what text to append and which list option to pick, so nothing is hard-coded. |
| **Auto** | Runs the workflow taught by Learn: waits for elements, fills fields with real framework events, checks your validation rules, optionally asks "Save?", clicks Generate → Print, takes over the new tab and clicks Apply. Stops with the step and the reason when something is wrong, including an error message shown by the application after Save. |
| **Validate** | Same Ctrl+click idea for validation rules: *A equals B*, *A differs from B*, *A is not empty*, *A equals / contains a text*, *A matches a regex*. Each rule says when it runs: before Save, before Generate, or manual only. Works with any field on any page. |
| **Check** | Runs the "manual only" rules on the current page, on any page. |
| **Show** | Shows what has been learned or recorded: steps, texts, rules, profiles, run log. Lets you add, delete or change the profiles (which person and organization are selected) of this computer. |
| **Export** | Creates a Play (or Auto) bookmarklet with your configuration built in (base64) and copies it to the clipboard (or shows it in a prompt). Lists every fixed text it contains before copying. Your profile can be left out: whoever runs it is asked for their own on the first run. |

### Validation rules in practice

Learn adds three default rules: the pasted value equals the copied value, the appended text is not empty,
a list value is chosen. Auto evaluates them right before Save; if one fails it stops and nothing is saved:

```
Auto stopped at "validation before Save": Validation failed, nothing was saved.
Rule 1 (equal): "line1" is "PCB-R10-MAIN rev.B" but "line2" is "PCB-R10-MAIN REV.B"
```

### Who and which organization: lists and profiles

Many forms ask for a person (and an organization). They are not in the script, they are a **profile** (`name` + optional `org`).

- A normal `<select>` list: pick it in Learn (the *User list* step) or simply choose it while recording.
- A **searchable list** (a field that opens a panel with a search box and result rows): in Learn teach the opener, the search field
  and one result row (`Skip this list` skips the whole group). Auto opens it, types the name, waits until the rows stop changing,
  and clicks the one row that contains the name (and the organization, when rows show it). It presses Enter if the list searches on Enter.
- **Never guessed:** if no row or more than one row matches (a person listed under two organizations), it stops, lists the rows and selects nothing.
  Put the organization into the profile to tell the rows apart.
- A separate **organization list** is taught the same way and filled from the profile's `org`.
- **Several profiles** (Show → change profiles): you are asked which one to use and the answer is remembered.
- Profiles typed in Show or asked on the first run are personal to the computer and override the ones in the configuration.

### Sharing a setup

Export leaves your profile out if you wish; the person who runs the exported bookmarklet is asked for their own on the
first run and the answer is remembered on their computer. The setup only works if their screens have the same layout and
element ids as yours (generated ids may differ, see the notes below).

### Notes on real-world pages

- **Iframes** of the same origin are supported: the frame path is stored with the selector. A cross-origin iframe cannot be reached by any bookmarklet.
- **Full page reloads** between steps kill the running script. Play and Auto continue from what they see, so click them again after each reload.
- **Generated ids** (common in enterprise UI frameworks) may change between sessions. Learn warns about ids that look generated and stores a fallback selector from stable attributes (`name`, `aria-label`, …) that is used when the id stops matching.
- **Error detection** after Save uses the element you may teach as the last Learn step plus a best-effort heuristic (`role=alert`, common error classes).
- **Save buttons** are recognised by their caption (`Save`, `Submit`, and a few non-English ones).
- **Slow applications:** Play waits up to 30 s for each element. The configuration accepts `opts.waitSec` (1-600) to change
  that; there is no menu for it yet.
- **Blocked or damaged storage** (some sandboxed frames, strict browser settings, a full quota): every bookmarklet says so
  instead of failing silently. A damaged recording in progress or learning state simply starts over.

## Design constraints

- Bookmarklets only. No extension, no program, no server.
- Every bookmarklet is **one line** starting with `javascript:`, with no `#` and no `%` in the code.
- No network access and no dynamic code: the build refuses to produce a bookmarklet that contains them.
- No real application data in this repository: no captured HTML, screenshots or exported configs (see `.gitignore`).
- Values are set with the native `value` setter plus `input` and `change` events, so frameworks (React, Angular, ADF, …) notice them.
- A new tab opened by the routine is taken over by wrapping `window.open`. Pop-ups must be allowed for the site.
- The system print dialog stays manual. JavaScript cannot (and should not) confirm it.
- If a browser disables `javascript:` bookmarks, the project does not work there. No workaround is attempted.

## Quick start (local, on the demo app)

You need Node.js 20+.

```bash
npm install
npx playwright install chromium
npm run build      # src/*.js  ->  dist/*.txt (one-line bookmarklets) + docs/index.html (installer)
npm run serve      # demo app at http://localhost:8000/mock/demo-app.html
npm test           # Playwright tests against the demo app
```

The demo app (`mock/demo-app.html`) imitates a typical routine (enter a code, search, pick a product, copy a line, fill,
save, generate, print, apply) with framework-style generated ids, random delays, a framework-like data model (only
`input`/`change` events update it), a test panel with codes you can "scan" by clicking, and an event log.
Variants are selected with `?variant=…` (comma separated):

| Variant | Effect |
| --- | --- |
| `nolist` | no User list (tests optional steps) |
| `iframe` | the form lives in an iframe |
| `reload` | full page reload between steps |
| `mangle` | the "framework" upper-cases the pasted line (tests the rules) |
| `saveerror` | Save always fails with an application error |
| `combo` | the User field is a searchable drop-down with late results; one person is in two organizations |
| `orgcombo` | adds an Organization drop-down of the same kind |
| `refreshprint` | after Generate, Print only appears once the page is refreshed |

## Using it on a real site

1. Open the installer page (below) or `docs/index.html` after a build.
2. Check first: a bookmark with the URL `javascript:alert('ok')` must show a dialog. If not, the browser blocks bookmarklets.
3. Drag **Record**, **Play**, **Dry run** (and the others you want) to the bookmarks bar, or press *Copy code* and paste the whole line into a new bookmark's URL field.
4. On the site click **Record**, do the routine once and answer the review questions.
5. Run **Dry run** on each screen, then **Play** on one item with the "Save?" question on.
6. Day to day: enter the input, click **Play** (or **Series** for many items).

### Publishing the installer on GitHub Pages

The installer is `docs/index.html`, generated by `npm run build` together with a copy of the demo app in `docs/mock/`.

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
mock/       demo app imitating a typical routine
tests/      Playwright tests that run the built bookmarklets against the demo app
docs/       installer page for GitHub Pages (generated) and SECURITY.md
```

The build wraps `common.js` + a script in an IIFE, minifies it with terser and **fails** if the result contains
`#`, `%`, a newline, an unfilled placeholder, or any network, navigation, loader or dynamic-code API (`fetch`,
`XMLHttpRequest`, `eval`, workers, `postMessage`, `createElement('script')`, …). `npm test` rebuilds first, and a test
checks that `dist/` is exactly what the sources build to.

### Review and test agents (Claude Code)

`.claude/agents/` holds subagents for working on this repository with Claude Code:

- `code-reviewer`: from [wshobson/agents](https://github.com/wshobson/agents) (MIT), with a section added for this project's rules.
- `playwright-test-planner`, `playwright-test-generator` and `playwright-test-healer`: generated by `npx playwright init-agents --loop=claude`. The healer is changed so that it never skips or weakens a test to make the suite pass.

The Playwright agents use the browser server in `.mcp.json`; Claude Code asks to enable it in a new session. `tests/seed.spec.js` is their starting page.

## Roadmap

- [x] Skeleton, shared helpers, build with character checks, first end-to-end test
- [x] Flexible learning steps (types, optional, Skip), configurable append text and list option
- [x] Validation while learning (wrong element type, duplicates, ambiguous selectors, generated-looking ids, summary, fallback selectors)
- [x] Generic validation rules (Validate, Check), error detection after Save
- [x] Demo app variants (iframe, reload, no list) and script support for them
- [x] Show and Export (Play/Auto with embedded configuration)
- [x] Installer page for GitHub Pages
- [x] Record and Play (no step-by-step teaching), Export of recordings
- [x] Dry run, Series, run log
- [x] Reliability: one run per page, no repeated Save after an unfinished run, Cancel/Esc with a progress bar, reasons
  for every wait that gives up, no guessing between several fallback matches, safe handling of damaged storage

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model, the audit results and the checklist to review before use on a real site.
