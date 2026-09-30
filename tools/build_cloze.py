#!/usr/bin/env python3
"""Validate the cloze game's authored content, and list what to write next.

Authored clozes live in tools/cloze/NNN.json, one file per batch:

    [{"w": "expect", "id": "9c73bd8aab", "a": "expecting",
      "c": "She's {{blank}} a baby in June."}]

`w` is the base word the player puts in their bank, `id` the wordset sense the
sentence was written for, `a` the form the sentence needs - what the player
spells - and `c` the sentence, with exactly one {{blank}}. Keys starting with
"_" are ignored.

Everything in SPEC.md §7 that can be checked mechanically is checked here, so a
bad hint cannot reach a player whoever - or whatever - wrote it.

    python3 tools/build_cloze.py                    validate; exit 1 on any reject
    python3 tools/build_cloze.py --todo 250         the next 250 senses to write
    python3 tools/build_cloze.py --todo 9 --only fall,mind
    python3 tools/build_cloze.py --json             machine-readable result
"""

import argparse
import json
import re
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from build_dict import LETTERS, WORD_RE, fetch_letter  # noqa: E402  (same bundle, same filter)

CLOZE_DIR = TOOLS / "cloze"
CACHE = TOOLS / ".wordset-cache"
INFLECTIONS = TOOLS / "inflections.json"

TIERS = ["zk", "gk", "cet4", "cet6", "ky", "toefl", "ielts", "gre"]
PER_WORD = 3
BLANK = "{{blank}}"
MAX_SENTENCES = 3
MAX_CHARS = 320
MIN_DEF_CHARS = 25
# Below this length a stem matches unrelated words (car -> career), so only
# longer words are also checked for derivations (quick -> quickly).
STEM_MIN = 5

# The inflections each part of speech may take. A derivation is a different
# word: quick -> quickly is never an answer for "quick".
KINDS_FOR = {
    "noun": ("s",),
    "verb": ("3", "p", "d", "i", "v"),
    "adjective": ("r", "t"),
    "adverb": ("r", "t"),
}
ALL_KINDS = ("s", "3", "p", "d", "i", "v", "r", "t")

# Definitions that describe grammar rather than meaning cannot anchor a cloze.
META_DEF = re.compile(
    r"^\(?(used|denoting|of or |relating to)|comparative|superlative|intensifier|"
    r"combining form|plural of|past tense|^a (letter|symbol)|^the \w+ letter",
    re.I,
)
BLANK_AFFIX = re.compile(r"[A-Za-z'’]\{\{blank\}\}|\{\{blank\}\}[A-Za-z'’]")
ANSWER_RE = re.compile(r"^[a-z]+(-[a-z]+)*$")

# Wordset senses that must never be clozed, regardless of who or what wrote
# the entry - not just slurs. Some carry no `labels` tag, so the usable()
# filter below would otherwise let them through, and they resurface in every
# --todo call until named here. Found two ways: scanning exam-word
# definitions for "offensive"/"disparaging"/"vulgar"/etc. and reading every
# hit by hand (most were ordinary vocabulary - disgusting, curse, attack -
# whose *definition* merely contains one of those words, and stayed in); and
# a data error caught during the meaning read of an actual batch. Excluded by
# (word, sense id): every other sense of these words (e.g. "tool" the
# implement, "chalk" the calcite stick, "queen" the royal title) is
# unaffected.
DENIED_SENSES = {
    # slurs
    ("boy", "e5e741cff0"),       # ethnic slur for a Black man
    ("spade", "78494b4b57"),     # ethnic slur for a Black person
    ("negro", "a5b0461378"),     # dated, offensive racial term
    ("fag", "c2342f2be1"),       # anti-gay slur
    ("fagot", "0cc35f2c46"),     # anti-gay slur
    ("fairy", "57f596ca2f"),     # anti-gay slur (this sense)
    ("queen", "a0f666279b"),     # anti-gay slur (this sense)
    ("hillbilly", "451c0f0b20"), # disparaging regional/class term
    ("mongrel", "35cb5be8f2"),   # derogatory-term sense (this sense)
    ("rabble", "5105245aba"),    # disparaging term for common people
    ("riffraff", "4eba077c2f"),  # disparaging term for common people
    ("shrimp", "ca64ffee89"),    # disparaging term for small people (this sense)
    ("softness", "f5a4ae3c81"),  # homophobic/gendered insult sense
    ("frog", "540a21054d"),      # ethnic slur for a French person (this sense)
    ("baggage", "07134bc64c"),   # derogatory, gendered term: "a worthless or immoral woman"
    # obscenities
    ("cock", "dbe472b674"),      # obscene term for penis
    ("prick", "b42157a643"),     # obscene term for penis
    ("shaft", "456a2873a7"),     # obscene term for penis (this sense)
    ("tool", "dc492b0787"),      # obscene term for penis (this sense)
    ("snatch", "0dcdd3aac5"),    # obscene term for female genitals (this sense)
    ("slit", "9ebcaf78ff"),      # obscene term for female genitals (this sense)
    ("dirt", "554c8fadd8"),      # obscene term for feces (this sense)
    ("bull", "3eccbb5d2f"),      # obscene slang ("bullshit") for behavior
    ("nut", "a36c26ef92"),       # obscene slang for testicle
    # drug slang, inappropriate for an exam-prep vocabulary game
    ("chalk", "6bef8be884"),     # slang for methamphetamine
    ("glass", "43f85fc3a1"),     # slang for methamphetamine (this sense)
    ("grass", "6f816c77eb"),     # slang for marijuana (this sense)
    ("ice", "923def2412"),       # slang for methamphetamine (this sense)
    ("key", "8ab8d082ab"),       # slang for a kilogram of narcotics (this sense)
    ("rope", "76f60556bb"),      # street name for flunitrazepam (a date-rape drug)
    ("soap", "3be6a07689"),      # street name for gamma hydroxybutyrate (a date-rape drug)
    ("dot", "91a3dbdf66"),       # street name for lysergic acid diethylamide (LSD)
    ("jet", "f58231dc3c"),       # street name for ketamine
    ("pot", "379647ed83"),       # street name for marijuana
    # sexually explicit, inappropriate for an exam-prep vocabulary game
    ("feel", "815234b322"),      # this sense: manual sexual stimulation
    ("love", "41469d1b21"),      # this sense: sexual intercourse
    ("neck", "9e7d9b1f64"),      # this sense: fondle with sexual passion ("necking")
    ("relation", "e7111c9574"), # this sense: the act of sexual procreation
    ("scarf", "8ce28672d5"),     # this sense: autoerotic asphyxiation
    ("bush", "72a3839aa1"),      # this sense: pubic hair
    # prostitution-related, inappropriate for an exam-prep vocabulary game
    ("madam", "beb6da0c20"),     # this sense: a woman who runs a brothel
    # objectifying/dated stereotype, inappropriate for an exam-prep vocabulary game
    ("lovely", "3d3b3b8df7"),    # this sense: "a very pretty girl who works as a photographer's model"
    ("sister", "b146bf5ae9"),    # this sense: slang term of address for attractive young women
    ("skirt", "cebecbe43d"),     # this sense: informal term for a (young) woman
    ("chick", "af33a17905"),     # this sense: informal term for a (young) woman
    ("maid", "91179860d3"),      # this sense: "an unmarried girl (especially a virgin)" ties status to virginity
    ("peach", "16433fcde2"),     # this sense: "a very attractive or seductive looking woman"
    # factually wrong definitions (wordset/WordNet data errors)
    ("egg", "a3d6f170a4"),       # this sense is testicle's definition, misfiled under "egg"
    ("planet", "bc03f09ee7"),    # this sense ("a person who follows or serves another") is satellite's, misfiled under "planet"
    ("shout", "5ff04b2535"),     # this sense ("use foul or abusive language towards") is a different word's (e.g. "curse"/"revile"), misfiled under "shout"
    ("bonus", "51bfa5bf35"),     # this sense ("anything that tends to arouse") is disconnected from any real meaning of "bonus"; almost certainly misfiled
    # structurally unclozable: the answer is spelled identically to one of the
    # most common function words in English, so the leak-check (which forbids
    # any other occurrence of the word's own spelling in the sentence) makes a
    # natural sentence essentially impossible to write
    ("in", "bb6db5df97"),        # "in" the length unit (=inch) collides with "in" the preposition
}


# ---- regular inflection rules, for words ECDICT lists no forms for ---------------
# They err on the permissive side (both "visited" and "visitted"): the aim is to
# reject nonsense and wrong-lexeme answers, and to catch leaks broadly.

def _plural(w):
    if re.search(r"(s|x|z|ch|sh)$", w):
        return {w + "es"}
    if re.search(r"[^aeiou]y$", w):
        return {w[:-1] + "ies"}
    if w.endswith("o"):
        return {w + "s", w + "es"}
    return {w + "s"}


def _past(w):
    if w.endswith("e"):
        return {w + "d"}
    if re.search(r"[^aeiou]y$", w):
        return {w[:-1] + "ied"}
    out = {w + "ed"}
    if re.search(r"[^aeiou][aeiou][^aeiouwxy]$", w):
        out.add(w + w[-1] + "ed")
    return out


def _ing(w):
    if w.endswith("ie"):
        return {w[:-2] + "ying"}
    out = {w + "ing"}
    if w.endswith("e") and not w.endswith(("ee", "ye", "oe")):
        out.add(w[:-1] + "ing")
    if re.search(r"[^aeiou][aeiou][^aeiouwxy]$", w):
        out.add(w + w[-1] + "ing")
    return out


# Degree forms (r/t) have no rule on purpose: most adjectives compare with
# "more"/"most", and a rule would invent words like "beautifuller".
RULES = {"s": _plural, "3": _plural, "p": _past, "d": _past, "i": _ing}


class Lexicon:
    """The exam words, their wordset senses and their inflected forms."""

    def __init__(self, cache_dir: Path = CACHE):
        self.inflections = json.loads(INFLECTIONS.read_text(encoding="utf-8"))
        self.senses: dict[str, list[dict]] = {}
        for letter in LETTERS:
            raw = fetch_letter(letter, cache_dir, refresh=False)
            for word, entry in json.loads(raw).items():
                if word not in self.inflections or not WORD_RE.match(word):
                    continue
                self.senses[word] = [
                    {"id": m.get("id"), "pos": m.get("speech_part", ""), "def": m["def"],
                     "ex": m.get("example", ""), "labels": m.get("labels")}
                    for m in (entry.get("meanings") or []) if m.get("def")
                ]
        self.by_id = {(w, s["id"]): s for w, ss in self.senses.items() for s in ss}
        self._leak_re: dict[str, re.Pattern] = {}

    def forms(self, word: str, kinds) -> set:
        listed = self.inflections.get(word, {}).get("forms", {})
        out = set()
        for kind in kinds:
            if listed.get(kind):
                out.update(listed[kind])
            elif kind in RULES:
                out.update(RULES[kind](word))
        return out

    def allowed(self, word: str, pos: str) -> set:
        """Forms that may stand in the blank for a sense with this part of speech."""
        return {word} | self.forms(word, KINDS_FOR.get(pos, ()))

    def leaks(self, word: str, text: str) -> list:
        """Every form of the word - and, for longer words, any word built on it."""
        if word not in self._leak_re:
            forms = sorted({word} | self.forms(word, ALL_KINDS), key=len, reverse=True)
            alts = "|".join(map(re.escape, forms))
            if len(word) >= STEM_MIN:
                alts += "|" + re.escape(word) + r"[a-z]+"
            self._leak_re[word] = re.compile(rf"\b(?:{alts})\b", re.I)
        return sorted({m.group(0).lower() for m in self._leak_re[word].finditer(text)})

    def usable(self, word: str, sense: dict) -> bool:
        d = sense["def"]
        return (sense["pos"] in KINDS_FOR and not sense["labels"] and len(d) >= MIN_DEF_CHARS
                and not META_DEF.search(d) and not self.leaks(word, d)
                and (word, sense["id"]) not in DENIED_SENSES)

    def targets(self, word: str) -> list:
        """Up to PER_WORD senses to write for, preferring ones wordset illustrates."""
        ok = [s for s in self.senses.get(word, []) if self.usable(word, s)]
        ok.sort(key=lambda s: 0 if s["ex"] else 1)  # stable: list order within each group
        return ok[:PER_WORD]

    def tier(self, word: str) -> str:
        return self.inflections[word]["tier"]


def load_batches(directory: Path) -> list:
    """(file, index, entry) for every authored entry, in file then list order."""
    out = []
    for path in sorted(directory.glob("*.json")):
        for index, entry in enumerate(json.loads(path.read_text(encoding="utf-8"))):
            out.append((path.name, index, entry))
    return out


def sentence_count(text: str) -> int:
    return len([s for s in re.split(r"[.!?]+", text.replace(BLANK, " x ")) if s.strip()])


def check(lex: Lexicon, entry: dict):
    """Return (code, detail) for the first rule the entry breaks, or None."""
    fields = {k: entry.get(k) for k in ("w", "id", "a", "c")}
    if not all(isinstance(v, str) and v for v in fields.values()):
        return "malformed", "needs non-empty strings w, id, a, c"
    w, sid, a, c = fields.values()

    if w not in lex.inflections or w not in lex.senses:
        return "unknown_word", f"{w!r} is not an exam word in the bundle"
    sense = lex.by_id.get((w, sid))
    if not sense:
        return "unknown_sense", f"{sid!r} is not a sense of {w!r}"
    if (w, sid) in DENIED_SENSES:
        return "denied_sense", f"{sid!r} of {w!r} is a slur/obscenity, excluded regardless of who authored it"
    if sense["pos"] not in KINDS_FOR:
        return "pos", f"part of speech {sense['pos']!r} has no cloze form"

    if c.count(BLANK) != 1:
        return "blank_count", f"expected exactly one {BLANK}, found {c.count(BLANK)}"
    if BLANK_AFFIX.search(c):
        return "blank_affix", "letters touch the blank; put the whole form in `a`"
    if sentence_count(c) > MAX_SENTENCES:
        return "sentences", f"{sentence_count(c)} sentences > {MAX_SENTENCES}"
    if len(c) > MAX_CHARS:
        return "length", f"{len(c)} characters > {MAX_CHARS}"

    if not ANSWER_RE.match(a):
        return "answer_chars", f"{a!r} must be lowercase letters"
    allowed = lex.allowed(w, sense["pos"])
    if a not in allowed:
        return "answer_form", f"{a!r} is not a valid {sense['pos']} form of {w!r}; allowed: {', '.join(sorted(allowed))}"

    leaked = lex.leaks(w, c.replace(BLANK, " "))
    if leaked:
        return "leak_sentence", f"the sentence contains {', '.join(leaked)}"
    leaked = lex.leaks(w, sense["def"])
    if leaked:
        return "leak_definition", f"the definition shown beside it contains {', '.join(leaked)}"
    return None


def validate(lex: Lexicon, batches: list):
    """Split authored entries into valid ones and rejects, enforcing uniqueness and the cap."""
    valid, rejects, seen, per_word = [], [], set(), {}
    for fname, index, entry in batches:
        problem = check(lex, entry)
        key = (entry.get("w"), entry.get("id"))
        if not problem and key in seen:
            problem = ("duplicate", "this sense already has a cloze")
        if not problem and per_word.get(key[0], 0) >= PER_WORD:
            problem = ("over_cap", f"{key[0]!r} already has {PER_WORD} clozes")
        if problem:
            rejects.append({"file": fname, "index": index, "w": entry.get("w"),
                            "id": entry.get("id"), "code": problem[0], "detail": problem[1]})
            continue
        seen.add(key)
        per_word[key[0]] = per_word.get(key[0], 0) + 1
        valid.append(entry)
    return valid, rejects


def payload(lex: Lexicon, valid: list) -> dict:
    """The cloze game's runtime data: base -> [[answer, sentence, definition, pos], ...]"""
    out: dict[str, list] = {}
    for e in valid:
        sense = lex.by_id[(e["w"], e["id"])]
        out.setdefault(e["w"], []).append([e["a"], e["c"], sense["def"], sense["pos"]])
    return out


def todo(lex: Lexicon, batches: list, limit: int, only=None) -> list:
    """The next senses to write, in tier order, never past a word's cap."""
    authored, count = set(), {}
    for _, _, e in batches:
        authored.add((e.get("w"), e.get("id")))
        count[e.get("w")] = count.get(e.get("w"), 0) + 1
    words = sorted((w for w in lex.senses if not only or w in only),
                   key=lambda w: (TIERS.index(lex.tier(w)), w))
    out = []
    for w in words:
        room = PER_WORD - count.get(w, 0)
        for s in lex.targets(w):
            if room <= 0 or len(out) >= limit:
                break
            if (w, s["id"]) in authored:
                continue
            out.append({"w": w, "id": s["id"], "pos": s["pos"], "def": s["def"], "ex": s["ex"],
                        "tier": lex.tier(w), "forms": sorted(lex.allowed(w, s["pos"]))})
            room -= 1
        if len(out) >= limit:
            break
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", type=Path, default=CLOZE_DIR, help="batch directory (default tools/cloze)")
    parser.add_argument("--cache-dir", type=Path, default=CACHE)
    parser.add_argument("--todo", type=int, metavar="N", help="print the next N senses to write, as JSON lines")
    parser.add_argument("--only", help="with --todo: comma-separated words to restrict to")
    parser.add_argument("--json", action="store_true", help="print the validation result as JSON")
    args = parser.parse_args()

    lex = Lexicon(args.cache_dir)
    batches = load_batches(args.dir) if args.dir.exists() else []

    if args.todo is not None:
        only = set(args.only.split(",")) if args.only else None
        for item in todo(lex, batches, args.todo, only):
            print(json.dumps(item, ensure_ascii=False))
        return 0

    valid, rejects = validate(lex, batches)
    if args.json:
        print(json.dumps({"entries": len(batches), "valid": len(valid), "rejects": rejects}, ensure_ascii=False))
        return 1 if rejects else 0

    targets = {w: len(lex.targets(w)) for w in lex.senses}
    playable = sum(1 for n in targets.values() if n)
    words_done = len({e["w"] for e in valid})
    print(f"batches   : {len({f for f, _, _ in batches})}  ({args.dir})")
    print(f"entries   : {len(batches):,}")
    print(f"valid     : {len(valid):,}")
    print(f"rejected  : {len(rejects):,}")
    for r in rejects:
        print(f"    {r['file']}#{r['index']} {r['w']}[{r['id']}] {r['code']}: {r['detail']}")
    print(f"coverage  : {words_done:,} / {playable:,} playable words,"
          f" {len(valid):,} / {sum(targets.values()):,} target clozes")
    return 1 if rejects else 0


if __name__ == "__main__":
    raise SystemExit(main())
