#!/usr/bin/env python3
"""Build hangman.html by embedding the wordset dictionary into the template.

Downloads the 26 wordset-dictionary letter files, trims each entry down to
``word -> [[definition, speech_part], ...]``, then gzips + base64-encodes the
result and substitutes it into ``__DICT_PAYLOAD__`` in the template.

The payload is pure ASCII, so it can sit inside a <script> block without any
HTML escaping concerns.

Usage:
    python3 tools/build_dict.py [--cache-dir DIR] [--refresh]
"""

import argparse
import base64
import gzip
import json
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

LETTERS = "abcdefghijklmnopqrstuvwxyz"
SOURCE_URL = "https://cdn.jsdelivr.net/gh/wordset/wordset-dictionary@master/data/{letter}.json"

# Single tokens only: the word-bank parser splits on whitespace and commas, so
# multi-word phrases could never be typed in as a question anyway. Hyphenated
# words stay because they survive that same parsing.
WORD_RE = re.compile(r"^[a-z]+(-[a-z]+)*$")

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = REPO_ROOT / "tools" / "hangman.template.html"
OUTPUT_PATH = REPO_ROOT / "hangman.html"
ZH_PATH = REPO_ROOT / "tools" / "zh_dict.json"
PLACEHOLDER = "__DICT_PAYLOAD__"
ZH_PLACEHOLDER = "__ZH_PAYLOAD__"


def fetch_letter(letter: str, cache_dir: Path, refresh: bool) -> bytes:
    """Return the raw JSON bytes for one letter file, downloading if needed."""
    cached = cache_dir / f"{letter}.json"
    if cached.exists() and not refresh:
        return cached.read_bytes()

    url = SOURCE_URL.format(letter=letter)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "hangman-build/1.0 (offline dictionary bundler)",
            "Accept-Encoding": "gzip",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)

    cache_dir.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(raw)
    return raw


def collect_entries(cache_dir: Path, refresh: bool) -> tuple[dict, dict]:
    """Download every letter file and trim it into the compact lookup table."""
    entries: dict[str, list[list[str]]] = {}
    stats = {"raw_bytes": 0, "skipped_phrase": 0, "skipped_no_def": 0, "definitions": 0}

    with ThreadPoolExecutor(max_workers=8) as pool:
        payloads = pool.map(
            lambda letter: (letter, fetch_letter(letter, cache_dir, refresh)), LETTERS
        )

        for letter, raw in payloads:
            stats["raw_bytes"] += len(raw)
            for word, entry in json.loads(raw).items():
                if not WORD_RE.match(word):
                    stats["skipped_phrase"] += 1
                    continue

                definitions = [
                    [meaning["def"], meaning.get("speech_part", "")]
                    for meaning in (entry.get("meanings") or [])
                    if meaning.get("def")
                ]
                if not definitions:
                    stats["skipped_no_def"] += 1
                    continue

                entries[word] = definitions
                stats["definitions"] += len(definitions)
            print(f"  {letter}.json  ({len(raw) / 1048576:5.2f} MB)", file=sys.stderr)

    return entries, stats


def build_payload(entries: dict) -> tuple[str, dict]:
    """Compact-serialize, gzip and base64 a lookup table."""
    compact = json.dumps(entries, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    compressed = gzip.compress(compact, 9)
    payload = base64.b64encode(compressed).decode("ascii")

    # The payload is inlined into a <script> block; make sure nothing in it can
    # terminate that block early.
    if "</script" in payload.lower():
        raise RuntimeError("payload contains a script-closing sequence")

    # Prove the browser will get back exactly what we put in.
    restored = json.loads(gzip.decompress(base64.b64decode(payload)).decode("utf-8"))
    if restored != entries:
        raise RuntimeError("gzip/base64 round-trip did not reproduce the dictionary")

    sizes = {
        "json_bytes": len(compact),
        "gzip_bytes": len(compressed),
        "b64_bytes": len(payload),
    }
    return payload, sizes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=REPO_ROOT / "tools" / ".wordset-cache",
        help="where the downloaded letter files are kept (default: tools/.wordset-cache)",
    )
    parser.add_argument(
        "--refresh", action="store_true", help="re-download even if cached files exist"
    )
    args = parser.parse_args()

    if not TEMPLATE_PATH.exists():
        print(f"error: template not found at {TEMPLATE_PATH}", file=sys.stderr)
        return 1

    print("Collecting wordset letter files...", file=sys.stderr)
    try:
        entries, stats = collect_entries(args.cache_dir, args.refresh)
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"error: could not download wordset data: {exc}", file=sys.stderr)
        print("       (the cache dir keeps previous downloads; retry when online)", file=sys.stderr)
        return 1

    payload, sizes = build_payload(entries)

    if not ZH_PATH.exists():
        print(f"error: {ZH_PATH} missing - run tools/build_zh.py first", file=sys.stderr)
        return 1
    zh = json.loads(ZH_PATH.read_text(encoding="utf-8"))
    zh = {w: t for w, t in zh.items() if w in entries}
    zh_payload, zh_sizes = build_payload(zh)

    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    for name in (PLACEHOLDER, ZH_PLACEHOLDER):
        if name not in template:
            print(f"error: {name} not found in template", file=sys.stderr)
            return 1
    OUTPUT_PATH.write_text(
        template.replace(PLACEHOLDER, payload).replace(ZH_PLACEHOLDER, zh_payload),
        encoding="utf-8",
    )

    mb = lambda n: f"{n / 1048576:.2f} MB"
    print("\nDictionary bundled:", file=sys.stderr)
    print(f"  words                : {len(entries):,}", file=sys.stderr)
    print(f"  definitions          : {stats['definitions']:,}", file=sys.stderr)
    print(f"  skipped (phrases)    : {stats['skipped_phrase']:,}", file=sys.stderr)
    print(f"  skipped (no def)     : {stats['skipped_no_def']:,}", file=sys.stderr)
    print(f"  source files         : {mb(stats['raw_bytes'])}", file=sys.stderr)
    print(f"  trimmed JSON         : {mb(sizes['json_bytes'])}", file=sys.stderr)
    print(f"  gzipped              : {mb(sizes['gzip_bytes'])}", file=sys.stderr)
    print(f"  base64 (embedded)    : {mb(sizes['b64_bytes'])}", file=sys.stderr)
    print(f"  zh words             : {len(zh):,}  ({len(zh) / len(entries) * 100:.1f}% covered)", file=sys.stderr)
    print(f"  zh trimmed JSON      : {mb(zh_sizes['json_bytes'])}", file=sys.stderr)
    print(f"  zh gzipped           : {mb(zh_sizes['gzip_bytes'])}", file=sys.stderr)
    print(f"  zh base64 (embedded) : {mb(zh_sizes['b64_bytes'])}", file=sys.stderr)
    print(f"\nWrote {OUTPUT_PATH} ({mb(OUTPUT_PATH.stat().st_size)})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
