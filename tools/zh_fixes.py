# -*- coding: utf-8 -*-
"""Taiwan-usage corrections applied after OpenCC s2twp.

s2twp handles the bulk (軟體/網路/硬碟 etc.); these are the terms it leaves in
mainland form, plus two over-conversions it introduces.
"""

import re

# Ordered: longer/compound forms first so they win over the catch-all.
RULES = [
    # --- OpenCC over-conversions ---
    ("計演算法", "計算法"),        # 计算法 -> wrongly became 計演算法
    ("沿軌道執行", "沿軌道運行"),   # 运行 -> wrongly became 執行
    ("勐", "猛"),                  # 猛 -> wrongly became 勐 (勐烈/勐然)

    # --- computing ---
    ("電子計算機", "電腦"),
    ("計算機", "電腦"),            # skipped for WORDS_KEEP_CALCULATOR

    # --- aerospace: Taiwan uses 航太 / 太空 ---
    ("航天空間", "航太空間"), ("航天技術", "航太技術"), ("航天學", "航太學"),
    ("航天飛船", "太空船"), ("航天飛行", "太空飛行"), ("航天艙", "太空艙"),
    ("航天器", "太空載具"), ("航天專家", "太空專家"), ("航天的", "航太的"),
    ("航天", "太空"),
    ("宇航員", "太空人"), ("宇宙飛行", "太空飛行"), ("宇航", "太空"),

    # --- everyday vocabulary ---
    ("導彈", "飛彈"),
    ("熊貓", "貓熊"),
    ("土豆", "馬鈴薯"),
    ("西紅柿", "番茄"),
    ("幼兒園", "幼稚園"),
    ("公交車", "公車"), ("公交", "公車"),
    ("摩托車", "機車"), ("摩托運動", "機車運動"), ("摩托化", "機動化"),

    # --- keyboard ---
    ("回車道", "迴車道"),          # turnaround = vehicle turning area
    ("回車", "Enter 鍵"),
]

# 質量 = "mass" in physics (correct in Taiwan); elsewhere it means quality -> 品質.
WORDS_KEEP_MASS = {"mass", "isobar", "gluon"}
# totalizator's 計算機 genuinely means "calculator", which is correct Taiwan usage.
WORDS_KEEP_CALCULATOR = {"totalizator"}

# Contextual fixes that a blanket rule would get wrong.
PER_WORD = {
    "coordination": [("程序協調", "程式協調")],
    "process":      [("[計] 程序", "[計] 行程")],
    "marginalize":  [("社會發展程序", "社會發展歷程")],
    "stacks":       [("程序堆疊應用", "程式堆疊應用")],
    "tenor":        [("穩定的程序", "穩定的歷程")],
    "event":        [("事情的程序", "事情的過程")],
    "scooter":      [("小型機車, 踏板車", "速克達, 小型機車")],
    "monitrice":    [("質量控制器", "品質管制器")],
    "servomechanical": [("[電腦、生物學、生理學]", "[電腦、生物學、生理學]")],
}


_PREFIX = re.compile(r"^(\s*(?:\[[^\]]+\]|[a-z]+\.)\s*)?(.*)$", re.S)


def dedupe_line(line: str) -> str:
    """After substitution a line can repeat a term (番茄, 番茄); collapse those.

    The leading part-of-speech marker ("n. ", "[計] ") has to be split off first,
    or the first term never compares equal to a later duplicate.
    """
    prefix, rest = _PREFIX.match(line).groups()
    prefix = prefix or ""
    if "," not in rest:
        return line
    seen, out = set(), []
    for part in rest.split(","):
        key = part.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
    return prefix + ", ".join(out)


def apply_fixes(word: str, text: str) -> str:
    for src, dst in RULES:
        if src == "計算機" and word in WORDS_KEEP_CALCULATOR:
            continue
        text = text.replace(src, dst)
    if word not in WORDS_KEEP_MASS:
        text = text.replace("質量", "品質")
    for src, dst in PER_WORD.get(word, []):
        text = text.replace(src, dst)
    return "\\n".join(dedupe_line(l) for l in text.split("\\n"))
