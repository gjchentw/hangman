#!/usr/bin/env python3
"""Generate tools/inflections.json: the exam words and their inflected forms.

The cloze game's answer is the form a sentence needs ("expecting", "fell"), so
the validator has to know which surface forms are real forms of which word.
ECDICT's `exchange` field is authoritative for that - irregulars (fell/fallen,
went/gone, children, better/best) and spelling changes (stopped, running) -
and it also carries the exam tags that define which words the cloze game uses.

Output, one word per line so diffs stay readable:

    {"fall": {"tier": "zk", "forms": {"p": ["fell"], "d": ["fallen"], ...}}, ...}

Form kinds: p past, d past participle, i -ing, 3 third person, s plural,
r comparative, t superlative, v other present forms (only `be` has any; they
come from the supplement). `tier` is the word's easiest exam tag, which orders
the authoring worklist.

    python3 tools/build_inflections.py [--ecdict PATH]
"""

import argparse
import csv
import json
import sys
import urllib.request
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from build_zh import ECDICT_URL, bundled_words  # noqa: E402  (same bundle, same source)

TIERS = ["zk", "gk", "cet4", "cet6", "ky", "toefl", "ielts", "gre"]
KINDS = {"p", "d", "i", "3", "s", "r", "t", "v"}
# ECDICT's undocumented `f` is an alternative plural: frescos, yen.
ALIASES = {"f": "s"}
TARGET = TOOLS / "inflections.json"
SUPPLEMENT = TOOLS / "inflection_supplement.json"


def parse_exchange(raw: str) -> dict:
    """'p:fell/d:fallen/0:fall/1:p' -> {'p': ['fell'], 'd': ['fallen']}"""
    forms: dict[str, list[str]] = {}
    for part in (raw or "").split("/"):
        kind, _, value = part.partition(":")
        kind = ALIASES.get(kind, kind)
        value = value.strip().lower()
        # 0/1 describe the lemma itself; an empty value carries nothing; and a
        # value with a space is periphrastic ("more replete"), not one word.
        if kind not in KINDS or not value or " " in value:
            continue
        forms.setdefault(kind, [])
        if value not in forms[kind]:
            forms[kind].append(value)
    return forms


def merge(forms: dict, extra: dict) -> dict:
    for kind, values in extra.items():
        bucket = forms.setdefault(kind, [])
        bucket.extend(v for v in values if v not in bucket)
    return forms


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ecdict", type=Path, default=TOOLS / ".ecdict.csv")
    parser.add_argument("--cache-dir", type=Path, default=TOOLS / ".wordset-cache")
    args = parser.parse_args()

    if not args.ecdict.exists():
        print(f"downloading ECDICT to {args.ecdict} ...", file=sys.stderr)
        urllib.request.urlretrieve(ECDICT_URL, args.ecdict)

    bundle = bundled_words(args.cache_dir)
    supplement = json.loads(SUPPLEMENT.read_text(encoding="utf-8"))
    supplement.pop("_comment", None)

    words: dict[str, dict] = {}
    csv.field_size_limit(10 ** 7)
    with args.ecdict.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            word = (row["word"] or "").strip().lower()
            tags = set((row["tag"] or "").split())
            tier = next((t for t in TIERS if t in tags), None)
            if not tier or word not in bundle or word in words:
                continue
            words[word] = {"tier": tier, "forms": parse_exchange(row["exchange"])}

    for word, extra in supplement.items():
        if word in words:
            merge(words[word]["forms"], extra)
        else:
            print(f"warning: supplement word {word!r} is not an exam word", file=sys.stderr)

    lines = [f"{json.dumps(w, ensure_ascii=False)}:{json.dumps(v, ensure_ascii=False, separators=(',', ':'))}"
             for w, v in sorted(words.items())]
    TARGET.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8")

    with_forms = sum(1 for v in words.values() if v["forms"])
    print(f"exam words           : {len(words):,}", file=sys.stderr)
    print(f"  with listed forms  : {with_forms:,}", file=sys.stderr)
    print(f"  rule fallback only : {len(words) - with_forms:,}", file=sys.stderr)
    for tier in TIERS:
        print(f"  tier {tier:<5}         : {sum(1 for v in words.values() if v['tier'] == tier):,}", file=sys.stderr)
    print(f"wrote {TARGET} ({TARGET.stat().st_size / 1024:.0f} KB)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
