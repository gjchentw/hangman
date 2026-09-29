# SPEC — Hangman 單字遊戲

## 1. Objective

A Hangman word game where the player guesses English words from their
definitions, shown in English or Traditional Chinese.

**Target users**: English learners (primarily Traditional Chinese readers) who
want to drill a word list of their own choosing.

**The defining constraint**: the game ships as **one self-contained
`hangman.html`** with the dictionary embedded. It must run correctly from
`file://` with the network switched off. Every design decision defers to this —
it is why the dictionaries are bundled rather than fetched, and why
pronunciation uses the platform's own speech engine instead of audio files.

### Non-goals

- No accounts, no server, no cross-device sync (state is per-browser)
- No build step for the *player* — they open one file
- No runtime dependency on any third-party service

## 2. Commands

| Command | When |
| --- | --- |
| `python3 tools/build_dict.py` | After any change to `tools/hangman.template.html`. Rebuilds `hangman.html`. |
| `python3 tools/build_dict.py --refresh` | Force re-download of the wordset source files. |
| `.venv/bin/python tools/build_zh.py` | Only when regenerating Chinese data. Needs network + `opencc`. |
| `npm test` | Run the jsdom suites. |
| `open hangman.html` | Manual check (required for audio and layout). |

Chinese-data toolchain, needed only for `build_zh.py`:

```bash
python3 -m venv .venv
.venv/bin/pip install opencc-python-reimplemented
```

Deployment is automatic: pushing to `main` runs
`.github/workflows/deploy.yml`, which publishes `hangman.html` as the Pages
`index.html`.

## 3. Project structure

```
hangman.html                    build artifact, ~4.8 MB — COMMITTED, Pages serves it
SPEC.md                         this file
README.md                       player-facing docs
tools/
  hangman.template.html         ← the real source: HTML + CSS + JS in one file
  build_dict.py                 wordset → trim → gzip → base64 → inject → hangman.html
  build_zh.py                   ECDICT → OpenCC s2twp → fixes → merge manual → zh_dict.json
  zh_fixes.py                   Taiwan-usage correction rules applied after OpenCC
  zh_manual.json                451 hand-written translations ECDICT lacks
  zh_dict.json                  generated; COMMITTED so builds need no 63 MB download
  .wordset-cache/               56 MB of source data — ignored
  .ecdict.csv                   63 MB source — ignored
tests/                          jsdom suites
.github/workflows/              deploy + test
```

The template carries two placeholders, `__DICT_PAYLOAD__` and `__ZH_PAYLOAD__`,
which `build_dict.py` replaces with gzip+base64 payloads. They are pure ASCII,
so they cannot break out of their `<script>` block.

### Runtime data shapes

```js
DICT_B64 → { word: [[definition, partOfSpeech], ...] }   // 68,352 words
ZH_B64   → { word: "n. 能力, 才幹\n[經] 能力, 才能" }      // 100% coverage
```

### localStorage keys

`hangman:v1:bank` · `:stats` · `:voice` · `:lang` · `:mode` — every read and
write wrapped in `try/catch` (private mode throws).

## 4. Code style

- **Vanilla JS, no framework, no runtime dependencies.** No bundler, no
  transpiler. The template is hand-written HTML/CSS/JS.
- One IIFE, `"use strict"`, grouped by `/* ---- section ---- */` banners.
- `const`/`let`; no `var`. Plain functions over classes.
- DOM via the local `$(id)` helper; build nodes with
  `document.createElement` + `replaceChildren`, never `innerHTML`.
- **A single `state` object** is the source of truth; `render()` reflects it.
  Never read game state back out of the DOM.
- CSS custom properties on `:root` for the palette; no inline styles beyond
  trivial layout attributes.
- Comments explain *why*, especially where behaviour is non-obvious — the
  strict-mode `preventDefault`, the novelty-voice blocklist, the 質量/品質
  context split. Keep those; they encode bugs already paid for.
- UI text is Traditional Chinese (Taiwan usage); code, identifiers and comments
  are English.

## 5. Testing strategy

jsdom-driven tests that load the **built `hangman.html`** and exercise it
through real DOM events — never by importing internals, which the IIFE does not
expose.

- `tests/` holds one suite per concern: core flow, resume, voice, language, mode
- `npm test` runs all of them and exits non-zero on failure
- `jsdom` is a devDependency; `node_modules/` is ignored
- CI runs the suites on every push, so a regression is caught before deploy

jsdom lacks several browser APIs the game uses; suites inject them in
`beforeParse`: `DecompressionStream`, `Blob`, `Response`, `atob`,
`TextDecoder`, and a stubbed `speechSynthesis` that records what *would* have
been spoken.

**What tests cannot cover** — verify these by hand in a real browser:

- whether audio actually sounds right (jsdom has no speech engine)
- layout, the 620 px breakpoint, key sizing on a phone
- CSS animations: the strict-mode caret, the wrong-key flash

Assert observable behaviour (rendered answer, lives, key classes, stored
values), not implementation details. Prefer a single-word bank in tests to make
the chosen word deterministic.

## 6. Boundaries

### Always

- Edit `tools/hangman.template.html`, then rebuild. **Never hand-edit
  `hangman.html`** — it is generated and your change will be overwritten.
- Run `python3 tools/build_dict.py` before committing a template change, so the
  committed artifact matches its source.
- Keep the game working offline from `file://`.
- Wrap every `localStorage` access in `try/catch`.
- Run `npm test` before pushing.

### Ask first

- Changing a dictionary source, or anything that moves the 100% Chinese
  coverage or the ~4.8 MB file size materially
- Bumping the `hangman:v1:` storage prefix (discards everyone's saved state)
- Adding a runtime dependency, or any network call
- Changing default difficulty: 6 wrong guesses, easy mode, Chinese definitions
- Touching `zh_manual.json` translations or `zh_fixes.py` rules

### Never

- Add `fetch`, `XMLHttpRequest`, `<script src>`, or external `<link>` to the
  game. The offline guarantee is the product.
- Commit `tools/.wordset-cache/`, `tools/.ecdict.csv`, `.venv/`,
  `node_modules/`, or `tasks/`.
- Reintroduce a runtime dictionary API. `api.dictionaryapi.dev` was measured
  down across multiple days; that is why the data is bundled.
- Pick a TTS voice by taking the first match for a language. macOS lists
  `Albert` first and `Bad News` second — both novelty voices. Rank by the
  preferred-name list.
- Use `innerHTML` with dictionary text.

## Data sources

| Source | Content | Licence |
| --- | --- | --- |
| [wordset-dictionary](https://github.com/wordset/wordset-dictionary) | English definitions | CC BY-SA 3.0 |
| [ECDICT](https://github.com/skywind3000/ECDICT) | Chinese translations | MIT |
| [OpenCC](https://github.com/BYVoid/OpenCC) | Simplified → Traditional (s2twp) | Apache-2.0 |
