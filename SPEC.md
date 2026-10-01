# SPEC — Hangman 單字遊戲

## 1. Objective

Two offline Hangman games for English learners — primarily Traditional Chinese
readers — drilling a word list of their own choosing. They share one engine and
differ only in how the word is hinted and what the player spells:

| | `hangman.html` 釋義版 | `hangman_cloze.html` 克漏字版 |
| --- | --- | --- |
| Hint | the word's definitions: EN (every sense) or 中文 (full gloss) | one cloze sentence, plus the definition of the sense it was written for |
| Player spells | the bank word | the word **as it appears in the sentence** — possibly inflected |
| Word pool | 68,352 words | exam-level words that have at least one cloze |
| Language toggle | 中文 / EN | none — English only |

Everything else is identical: 簡易/嚴格 modes, 6 wrong guesses, the QWERTY
keyboard, TTS with voice/pitch/rate controls, Space to speak mid-round and to
advance after it, resuming the last word bank, and stats.

### The inflection rule (克漏字版)

A cloze uses the form its grammar requires, and **that form is the answer**:

| Bank word | Hint | Player spells |
| --- | --- | --- |
| `expect` | She's `_________` a baby in June. | `expecting` |
| `fall` | The old regime finally `____` after years of protests. | `fell` |
| `mind` | He's one of the great `_____` of his generation. | `minds` |
| `plan` | We need a proper `____` before Monday. | `plan` |

- The bank is entered and matched in **base form** — the player never types
  inflections into it.
- The blank's width equals the answer's length, so it stays an honest clue.
- One word can yield a different form each round (`fell` today, `falling`
  tomorrow), because each round picks one of the word's clozes at random.
- When the answer differs from the bank word, the result screen shows both:
  `fell ← fall`.
- Once the round ends, the blank fills in, so the sentence can be read whole.

### The defining constraint

Each game ships as **one self-contained HTML file** with its data embedded, and
must run from `file://` with the network off. This is why the dictionaries are
bundled rather than fetched, and why pronunciation uses the platform's speech
engine instead of audio files.

### Non-goals

- No accounts, no server, no cross-device sync (state is per-browser)
- No build step for the *player* — they open one file
- No runtime dependency on any third-party service
- **No modal-auxiliary senses.** Wordset is WordNet-derived and has none:
  `can` is a tin can or "to fire someone", `will` is volition or a legal
  document, `must` is grape juice, `may` is a hawthorn shrub, `might` is
  physical strength, and `shall/should/could/would` are absent. The cloze game
  follows wordset, so `can` is clozed as a tin can. `be/have/do` carry genuine
  verb senses and are inflected normally (`was`, `had`, `did`).

## 2. Commands

| Command | When |
| --- | --- |
| `python3 tools/build_dict.py` | After any template or data change. Rebuilds **both** games. |
| `python3 tools/build_dict.py --refresh` | Force re-download of the wordset source files. |
| `.venv/bin/python tools/build_zh.py` | Regenerate Chinese data. Needs network + `opencc`. |
| `python3 tools/build_inflections.py` | Regenerate `inflections.json` from ECDICT. Needs network. Rarely. |
| `python3 tools/build_cloze.py --todo 250` | Print the next 250 senses still needing a cloze, in tier order. |
| `python3 tools/build_cloze.py` | Validate every authored cloze and print warnings. Exits non-zero on any reject (warnings never fail it). No network, no key. |
| `npm test` | Run the jsdom suites. |
| `open hangman.html` / `open hangman_cloze.html` | Manual check — required for audio and layout. |

Chinese-data toolchain, needed only for `build_zh.py`:

```bash
python3 -m venv .venv
.venv/bin/pip install opencc-python-reimplemented
```

Deployment is automatic: pushing to `main` runs `.github/workflows/deploy.yml`,
which publishes `index.html` (= `hangman.html`), `hangman.html` and
`hangman_cloze.html`.

## 3. Project structure

```
hangman.html                   釋義版 build artifact, ~4.8 MB — COMMITTED
hangman_cloze.html             克漏字版 build artifact, ~1.6 MB at full scope — COMMITTED
SPEC.md                        this file
README.md                      player-facing docs for both games
tools/
  hangman.template.html        ← the single source for BOTH games
  build_dict.py                wordset + zh + clozes → both HTML files
  build_zh.py                  ECDICT → OpenCC s2twp → fixes → manual → zh_dict.json
  zh_fixes.py                  Taiwan-usage corrections applied after OpenCC
  zh_manual.json               451 hand-written translations ECDICT lacks
  zh_dict.json                 generated; COMMITTED so builds need no 63 MB download
  build_inflections.py         ECDICT exchange field → inflections.json
  inflections.json             each exam word's tier and inflected forms — COMMITTED
  inflection_supplement.json   hand-kept forms ECDICT lacks (am/are/were …) — COMMITTED
  build_cloze.py               cloze validator + worklist (§7)
  cloze/NNN.json               authored clozes, one file per batch — COMMITTED, append-only (§7)
  .wordset-cache/              56 MB source data — ignored
  .ecdict.csv                  63 MB source — ignored
tests/                         jsdom suites; tests/fixtures/cloze/ trips every validator rule and warning
.github/workflows/             deploy + test
```

### One template, two games

The template carries a `__VARIANT__` placeholder (`"plain"` or `"cloze"`), and
`build_dict.py` emits both files from it. Each file embeds only the payloads it
uses; the unused placeholders become empty strings.

A second template is ruled out: the two games must behave identically outside
the hint, and two copies of a ~1,000-line file would drift apart.

### Runtime data shapes

```js
// hangman.html
DICT_B64  → { word: [[definition, partOfSpeech], ...] }            // 68,352 words
ZH_B64    → { word: "n. 能力, 才幹\n[經] 能力, 才能" }                // 100% coverage

// hangman_cloze.html — self-contained, carries neither of the above
CLOZE_B64 → { base: [[answer, sentence, definition, partOfSpeech], ...] }   // ≤ 3 per word
```

Definitions are copied into the cloze payload at build time, so the cloze game
does not carry the 7.8 MB dictionary.

Authored clozes point at a wordset sense by its **meaning `id`** (e.g.
`"42a93f1709"`), not by its position in the list. The pilot used positions; a
position silently points at a different sense if the upstream list ever changes,
whereas an id either resolves or fails loudly.

### The blank

Clozes store the literal marker `{{blank}}`. The game renders it as **one
underscore per character of the answer** — the inflected form, so `expecting`
renders as 9 underscores. A suffix is never stored outside the blank: the pilot's
`{{blank}}s` and `{{blank}}ing` rendered as `_____s` and `____ing`, which is the
bug the inflection rule exists to fix.

### localStorage keys

Both files are served from one origin — on Pages, and on `file://` in most
browsers — so their storage would collide. The cloze game uses the prefix
`hangman-cloze:v1:` for `bank`, `stats` and `mode`. The voice preference
`hangman:v1:voice` is shared on purpose: it describes the device, not the game.

Every read and write is wrapped in `try/catch` (private mode throws).

## 4. Code style

- **Vanilla JS, no framework, no runtime dependencies.** No bundler, no
  transpiler. The template is hand-written HTML/CSS/JS.
- One IIFE, `"use strict"`, grouped by `/* ---- section ---- */` banners.
- `const`/`let`; no `var`. Plain functions over classes.
- DOM via the local `$(id)` helper; build nodes with `document.createElement`
  + `replaceChildren`, never `innerHTML`.
- **A single `state` object** is the source of truth; `render()` reflects it.
  Never read game state back out of the DOM.
- **Variant differences go through the one `VARIANT` constant** and stay few:
  where the hint comes from, what the answer is, whether the language toggle
  exists, the storage prefix. No parallel copy-pasted functions.
- CSS custom properties on `:root` for the palette.
- Comments explain *why*, especially where behaviour is non-obvious — the
  strict-mode `preventDefault`, the novelty-voice blocklist, the 質量/品質 split,
  the id-not-index rule. Keep those; they encode bugs already paid for.
- UI text is Traditional Chinese (Taiwan usage); code and comments are English.

## 5. Testing strategy

jsdom-driven tests load the **built HTML files** and drive them through real DOM
events — never by importing internals, which the IIFE does not expose.

- `tests/` holds one suite per concern: core flow, resume, voice, language,
  mode, space bar, cloze
- `npm test` runs all of them against both files and exits non-zero on failure
- `jsdom` is a devDependency; `node_modules/` is ignored
- CI runs `npm test` and `python3 tools/build_cloze.py` on every push

Suites inject what jsdom lacks in `beforeParse`: `DecompressionStream`, `Blob`,
`Response`, `atob`, `TextDecoder`, and a stubbed `speechSynthesis` that records
what *would* have been spoken.

**What tests cannot cover** — check by hand in a real browser: audio quality,
layout and the 620 px breakpoint, CSS animations.

Assert observable behaviour, not implementation. Prefer a single-word bank so
the chosen word is deterministic.

Invariants worth asserting, because they are how this breaks silently:

- `hangman.html` shows every EN definition and no cloze UI
- `hangman_cloze.html` has no language toggle and no Chinese gloss (its UI labels
  are Chinese, like the other game's)
- the answer area, the rendered blank and the answer all have the same length
- the rendered hint never contains any form of the answer's word
- the result screen shows `answer ← base` exactly when they differ
- a blank that opens a sentence fills in capitalized (`Pigeons gathered…`), while
  the answer area and result screen keep the lowercase answer
- TTS in the cloze game speaks the answer, not the bank word
- a bank word with no cloze is listed as unavailable and never drawn
- the cloze game does not resume the plain game's word bank, and vice versa
- both games show the data-sources footer with each source's licence

## 6. Boundaries

### Always

- Edit `tools/hangman.template.html`, then rebuild. **Never hand-edit either
  HTML file** — both are generated.
- Rebuild before committing a template or data change, so both artifacts match
  their source.
- Run `python3 tools/build_cloze.py` after writing clozes and fix every reject
  before committing.
- Keep both games working offline from `file://`.
- Wrap every `localStorage` access in `try/catch`.
- Run `npm test` before pushing.
- Keep the data-sources footer in both games. wordset's CC BY-SA licence asks
  for attribution wherever its content is shown, and the published site is
  only the HTML files — README never reaches a player.

### Ask first

- Changing the cloze scope, the per-word cap, or the tier order
- Adding senses that wordset lacks (such as modal auxiliaries)
- Changing a dictionary source, or anything that moves either file's size
  materially
- Bumping a storage prefix (discards saved state)
- Adding a runtime dependency or any network call
- Changing default difficulty: 6 wrong guesses, easy mode, Chinese definitions
- Touching `zh_manual.json` translations or `zh_fixes.py` rules

### Never

- Add `fetch`, `XMLHttpRequest`, `<script src>`, or external `<link>` to either
  game. The offline guarantee is the product.
- Commit `tools/.wordset-cache/`, `tools/.ecdict.csv`, `.venv/`,
  `node_modules/`, or `tasks/`.
- Reintroduce a runtime dictionary API. `api.dictionaryapi.dev` was measured
  down across multiple days.
- Pick a TTS voice by the first match for a language. macOS lists `Albert` first
  and `Bad News` second — both novelty voices.
- Use `innerHTML` with dictionary or cloze text.
- Ship a cloze that contains any form of its own word outside the blank, stores a
  suffix outside the blank, or whose answer is not a valid form of the word for
  that sense's part of speech. All three are checked mechanically.
- Let `hangman.html` show cloze UI, or `hangman_cloze.html` show a language
  toggle.

## 7. Cloze content (`hangman_cloze.html`)

### Scope

Exam-tagged words (ECDICT `zk` 中考, `gk` 高考, `cet4`, `cet6`, `ky` 研究所,
`toefl`, `ielts`, `gre`), **up to 3 usable senses per word**:
**12,608 words / 24,501 target senses**, as `build_cloze.py` measures it
(all written as of batch `100`).

A sense is usable when it is a noun, verb, adjective or adverb; carries no wordset
`labels` (archaic, slang, technical); has a definition of at least 25 characters
that describes meaning rather than grammar (not "used to form the comparative");
and whose definition gives the word away neither by a form of it nor, for words
of 5+ letters, by a word built on it — "a marketplace where groceries are sold"
cannot hint at `market`. Up to 3 are taken per word, preferring senses that
have a wordset example sentence, then list order.

Some senses pass all of that and still must never be clozed, so
`DENIED_SENSES` in `build_cloze.py` names them by `(word, id)`, each with a
comment saying why. The categories: slurs and outdated clinical insults;
obscenities; drug slang; sexually explicit or sexual-violence senses;
prostitution; objectifying or virginity/chastity-defined senses; distressing
medical senses; definitions misfiled from another headword (`lucre` carrying
`profit`'s definition word for word); and usage notes that are not meanings
(`credible`: "a common but incorrect usage for 'credulous'"). Only the named
sense is excluded; the word's other senses stay in scope. A denied sense
drops out of `--todo`, and an authored entry pointing at one is rejected.

Work proceeds in tier order — `zk`, `gk`, `cet4`, `cet6`, `ky`, `toefl`,
`ielts`, `gre` — which is already pedagogically ordered. Raw frequency order is
avoided: its head is function words.

### Authoring

- Written in Claude Code sessions. **No API calls and no API key.**
- About **250 per batch** — the ceiling at which the pilot's sentences stayed
  varied rather than formulaic. At the full scope that is ~100 batches, spread
  across many sessions.
- Each batch is one committed file `tools/cloze/NNN.json`. The game ships at any
  coverage level; coverage grows batch by batch.
- **Append-only means files, not lines.** A batch file is never deleted,
  renumbered or reordered, so `NNN.json#index` keeps pointing at the same
  entry. An entry *is* fixed in place when it turns out wrong — its sentence,
  its answer, or, when its sense is denied, its sense — and the commit says
  why. A correction must not go in a new batch: the validator keeps the first
  entry for a `(w, id)` and rejects the later one as a duplicate.
- **Every batch gets a meaning read**: each sentence printed with its answer
  filled in, beside the definition it was written for. The validator checks
  form, never meaning — the pilot passed it with 7 of 299 saying the wrong
  thing, such as a sentence written for "inactivity" under the sense "the state
  of being active".
- The validator accepts **any** allowed form of the word, so the meaning read
  also checks that `a` is the form *this* sentence needs: after "to" or a
  modal it is the base form ("trying to {{blank}}" is `speed`, not `sped`),
  after "was" a participle, after "six" a plural.

```json
[
  {"w": "expect", "id": "…", "a": "expecting",
   "c": "She's {{blank}} a baby in June. They only told the family last night."}
]
```

### A cloze must

1. Be **at most 3 sentences**
2. Read as **colloquial, everyday English** — plain words over literary ones
3. Contain **exactly one** `{{blank}}`
4. Fit the **specific sense** it was written for, not the word's commonest one
5. Use the form its grammar requires, and record that form in `a`
6. Make that form an **inflection** — plural, third-person `-s`, past, past
   participle, `-ing`, comparative, superlative. A derivation is a different
   word: `quick → quickly` is not allowed
7. Never contain any form of the word outside the blank

### Validation (`build_cloze.py`, blocking in CI)

Mechanically checked for every entry:

- `id` resolves to a sense of `w`
- exactly one `{{blank}}`, with **no letter or apostrophe touching it** on either
  side — this is what catches `{{blank}}s`
- at most 3 sentences and 320 characters
- `a` is an allowed form for that sense's part of speech:

  | Part of speech | Allowed forms |
  | --- | --- |
  | noun | base, plural |
  | verb | base, 3rd-person `-s`, past, past participle, `-ing` |
  | adjective | base, comparative, superlative |
  | adverb | base, plus comparative/superlative where listed |

  Forms come from `inflections.json` (ECDICT's `exchange` field — authoritative
  for irregulars like `fell/fallen`, `went/gone`, `children`, `better/best`, and
  for spelling changes like `stopped`, `running`). `inflection_supplement.json`
  fills the gaps ECDICT leaves, such as `be → am/are/were`. The 3,767 exam words
  ECDICT lists no forms for fall back to regular rules — permissively, so an
  uncountable noun like `information` would accept `informations`; the leak and
  blank checks are unaffected.
- no form of `w`, of any part of speech, appears in the sentence outside the
  blank, or in the definition shown beside it (case-insensitive); for words of
  5+ letters, neither does a word built on it (`quick` → `quickly`) — shorter
  stems would match unrelated words (`car` → `career`)
- no duplicate `(w, id)`, and at most 3 clozes per word

It also **warns**, without failing the run, about entries that pass every rule
but read badly — both crept in by the hundred before the checks existed:

- `short`: fewer than 5 words, usually a fragment copied from a dictionary
  example ("Winnow chaff.")
- `shared_sentence`: within 2 words of another cloze's sentence, usually a
  synonym given the same frame ("His {{blank}} decision to resign shocked the
  entire office" for both `impulsive` and `precipitant`)

Warnings are fixed like rejects; the count is meant to stay at zero.

Coverage counts only clozes for target senses. A valid cloze for a sense
outside the target list (two pilot entries) still ships, and is reported on
its own line.

`build_cloze.py` exits non-zero on any reject and names the reason, so rejects
are rewritten in the same session. `build_dict.py` also excludes any invalid
entry from the payload, so a reject that slipped through still cannot reach a
player.

### Migrating the 300-entry pilot

The pilot predates the inflection rule. Every entry is converted and re-reviewed:

- position → meaning `id`
- the 12 suffix hacks fold into the answer: `{{blank}}s` with `mind` becomes
  `{{blank}}` with `"a": "minds"`
- every sentence is re-read for the form its grammar demands — `expect[1]` →
  `expecting`, `build[3]` → `built`, `fall[3]`/`fall[11]` → `fell`,
  `receive[2]` → `received`, `sense[1]` → `senses`

Done as batch `001`: **299 clozes for 150 words**. Sixteen pilot senses were
dropped because their definition gives the word away; fifteen were replaced by
another sense of the same word, and `police` has no other usable sense.

### Size

`hangman.html` returns to ~4.8 MB — it no longer carries clozes.
`hangman_cloze.html` is ~1.6 MB at full scope, since it carries only clozes and
their definitions.

## Data sources

| Source | Content | Licence |
| --- | --- | --- |
| [wordset-dictionary](https://github.com/wordset/wordset-dictionary) | English definitions and senses | CC BY-SA 3.0 |
| [ECDICT](https://github.com/skywind3000/ECDICT) | Chinese translations, exam tags, inflected forms | MIT |
| [OpenCC](https://github.com/BYVoid/OpenCC) | Simplified → Traditional (s2twp) | Apache-2.0 |
