#!/usr/bin/env python3
"""Generate tools/zh_dict.json - the Traditional Chinese half of the bundle.

Pipeline:
  1. ECDICT (MIT, ~770k entries) provides Simplified Chinese glosses.
  2. Keep only the words the game actually bundles.
  3. OpenCC s2twp converts to Traditional Chinese with Taiwan phrasing.
  4. tools/zh_fixes.py corrects terms s2twp leaves in mainland form.
  5. tools/zh_manual.json supplies hand-written translations for the words
     ECDICT does not cover.

Needs network + opencc, so it is kept separate from build_dict.py; the JSON it
writes is committed alongside the other build inputs.

    python3 -m venv .venv && .venv/bin/pip install opencc-python-reimplemented
    .venv/bin/python tools/build_zh.py
"""

import argparse
import csv
import json
import re
import sys
import urllib.request
from pathlib import Path

ECDICT_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
REPO_ROOT = Path(__file__).resolve().parent.parent
TOOLS = REPO_ROOT / "tools"
WORD_RE = re.compile(r"^[a-z]+(-[a-z]+)*$")

sys.path.insert(0, str(TOOLS))


def bundled_words(cache_dir: Path) -> set:
    """The same word set build_dict.py bundles, from the wordset cache."""
    words = set()
    for path in sorted(cache_dir.glob("*.json")):
        for word, entry in json.loads(path.read_text(encoding="utf-8")).items():
            if WORD_RE.match(word) and any(m.get("def") for m in (entry.get("meanings") or [])):
                words.add(word)
    if not words:
        raise SystemExit(f"no wordset data in {cache_dir}; run build_dict.py first")
    return words


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=TOOLS / ".wordset-cache")
    parser.add_argument("--ecdict", type=Path, default=TOOLS / ".ecdict.csv")
    args = parser.parse_args()

    from opencc import OpenCC
    import zh_fixes

    words = bundled_words(args.cache_dir)
    print(f"bundled words        : {len(words):,}", file=sys.stderr)

    if not args.ecdict.exists():
        print(f"downloading ECDICT to {args.ecdict} ...", file=sys.stderr)
        urllib.request.urlretrieve(ECDICT_URL, args.ecdict)

    cc = OpenCC("s2twp")
    out, rows = {}, 0
    csv.field_size_limit(10 ** 7)
    with args.ecdict.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            rows += 1
            word = (row["word"] or "").strip().lower()
            text = (row["translation"] or "").strip()
            if word in words and text and word not in out:
                fixed = zh_fixes.apply_fixes(word, cc.convert(text))
                out[word] = fixed.replace("\\n", "\n")
    print(f"ecdict rows scanned  : {rows:,}", file=sys.stderr)
    print(f"matched from ECDICT  : {len(out):,}", file=sys.stderr)

    manual = json.loads((TOOLS / "zh_manual.json").read_text(encoding="utf-8"))
    added = 0
    for word, text in manual.items():
        if word in words and word not in out:
            out[word] = text
            added += 1
    print(f"hand-translated      : {added:,}", file=sys.stderr)

    uncovered = sorted(words - set(out))
    print(f"still untranslated   : {len(uncovered):,}", file=sys.stderr)

    target = TOOLS / "zh_dict.json"
    target.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"\nwrote {target} ({target.stat().st_size / 1048576:.2f} MB, {len(out):,} words)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
