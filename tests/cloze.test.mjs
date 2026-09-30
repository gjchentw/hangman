// The cloze game, driven through its built file against real authored content.
// plan's clozes all answer "plan" and expect's mix "expecting" with "expect",
// which makes those two deterministic. fall's do NOT all answer the same
// thing - it now has two "fell" entries and one plain "fall" (hit its 3-per-
// word cap in zk batch 005) - so any test using "fall" must not assume which
// of the two a given round drew. This is the general shape every future
// batch can create for any word at its cap: assert against whatever the game
// actually reports (g.answer()), never a hardcoded literal.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, voice } from "./helpers/boot.mjs";

const FILE = "hangman_cloze.html";
const inflections = JSON.parse(readFileSync(new URL("../tools/inflections.json", import.meta.url), "utf8"));
const formsOf = (w) => [w, ...Object.values(inflections[w].forms).flat()];
const setMode = (g, mode) => [...g.$("mode").children].find((b) => b.dataset.mode === mode).click();
const blank = (g) => g.$("defs").querySelector(".blank");

// The result line is "answer" when it equals the base word, or "answer ← base".
const resultLine = (answer, base) => (answer === base ? answer : `${answer} ← ${base}`);

// Wins the round in easy mode without knowing in advance which of a word's
// current answers was drawn: guessing the union of letters across every
// possible answer always solves it (and never over-guesses - typing "abc...z"
// would blow well past the 6-life budget on a short word).
const winAnyOf = (g, ...possibleAnswers) => {
  const letters = new Set(possibleAnswers.join(""));
  for (const letter of letters) g.key(letter);
};

describe("a round from a word with more than one possible answer", () => {
  // "fall" is at its 3-cloze cap: two entries answer "fell", one answers the
  // base "fall" itself. Every assertion below must hold for whichever the
  // random pick drew this time.
  let g;
  before(async () => { g = boot({ file: FILE }); await g.play("fall"); });
  after(() => g.close());

  test("hints with one cloze and one definition", () => {
    const rows = [...g.$("defs").children];
    assert.equal(rows.length, 2);
    assert.ok(rows[0].classList.contains("cloze"));
    assert.equal(rows[1].querySelector(".pos").textContent, "verb");
  });

  test("the answer area, the blank and the answer are all four long", () => {
    assert.equal(g.answer(), "____");
    assert.equal(blank(g).textContent, "____");
  });

  test("the hint contains no form of the word", () => {
    const text = g.$("defs").textContent.toLowerCase();
    for (const form of formsOf("fall")) {
      assert.doesNotMatch(text, new RegExp(`\\b${form}\\b`), `leaks "${form}"`);
    }
  });

  test("the hint carries no Chinese gloss", () => {
    assert.doesNotMatch(g.$("defs").textContent, /[一-鿿]/);
  });

  test("winning shows the result line matching whichever answer was drawn", () => {
    winAnyOf(g, "fall", "fell");
    const answer = g.answer();
    assert.ok(answer === "fall" || answer === "fell", `unexpected answer ${answer}`);
    assert.equal(g.$("result-title").textContent, "答對了！");
    assert.equal(g.$("result-word").textContent, resultLine(answer, "fall"));
  });

  test("once the round is over the sentence reads whole", () => {
    assert.equal(blank(g).textContent, g.answer());
    assert.ok(blank(g).classList.contains("filled"));
  });

  test("stats are saved under the cloze game's own prefix", () => {
    assert.equal(g.stored("hangman-cloze:v1:stats").won, 1);
  });
});

describe("a round whose answer is the bank word itself", () => {
  let g;
  before(async () => { g = boot({ file: FILE }); await g.play("plan"); });
  after(() => g.close());

  test("shows the answer without an arrow", () => {
    g.type("plan");
    assert.equal(g.$("result-word").textContent, "plan");
  });
});

describe("a word whose clozes need different forms", () => {
  let g;
  before(async () => { g = boot({ file: FILE }); await g.play("expect"); });
  after(() => g.close());

  test("every round keeps the blank as long as that round's answer", () => {
    const seen = new Set();
    for (let round = 0; round < 24; round++) {
      assert.equal(blank(g).textContent.length, g.answer().length);
      g.type("abcdefghijklmnopqrstuvwxyz");
      const answer = g.answer();
      seen.add(answer);
      assert.equal(g.$("result-word").textContent, answer === "expect" ? "expect" : `${answer} ← expect`);
      g.$("next").click();
    }
    assert.deepEqual([...seen].sort(), ["expect", "expecting"]);
  });
});

describe("strict mode", () => {
  let g;
  before(async () => { g = boot({ file: FILE }); await g.play("fall"); setMode(g, "strict"); });
  after(() => g.close());

  test("spells whichever answer was drawn, in order", () => {
    // "fall" and "fell" both start with f, so position 0 is safe to guess
    // blind. They diverge at position 1 ('a' vs 'e'); trying 'a' there and
    // watching whether it advances tells us which one this round drew,
    // without needing to know in advance - the same "wrong letter costs a
    // life" behaviour this test exercised before the word gained a second
    // possible answer.
    g.key("f");
    assert.equal(g.lives(), "6", "f is correct either way");
    g.key("a");
    const isFall = g.answer()[1] === "a";
    assert.equal(g.lives(), isFall ? "6" : "5");
    if (!isFall) g.key("e");
    g.type("ll");
    const answer = isFall ? "fall" : "fell";
    assert.equal(g.answer(), answer);
    assert.equal(g.$("result-word").textContent, resultLine(answer, "fall"));
  });
});

describe("pronunciation", () => {
  let g;
  before(async () => { g = boot({ file: FILE, voices: [voice("Samantha", "en-US")] }); await g.play("fall"); });
  after(() => g.close());

  test("says the answer, not necessarily the bank word", () => {
    // g.answer() is masked ("____") until the round is solved, so it cannot
    // stand in for "the real target" until then. Speak first (mid-round,
    // exercising the actual behaviour under test), then win to reveal what
    // the target actually was and check the two agree.
    g.key(" ");
    const spokenMidRound = g.spoken.at(-1).text;
    winAnyOf(g, "fall", "fell");
    assert.equal(spokenMidRound, g.answer(), "should have spoken this round's real answer, not the masked blank");
  });
});

describe("the word bank", () => {
  let g;
  before(() => { g = boot({ file: FILE }); });
  after(() => g.close());

  test("is matched on base form; a word with no cloze is listed as unavailable", async () => {
    await g.load("fall,fell,zzzqqq");
    assert.equal(g.$("count-ok").textContent, "1");
    assert.equal(g.$("missing-list").textContent, "fellzzzqqq");
  });

  test("an unavailable word is never drawn", async () => {
    await g.play("fall,zzzqqq");
    for (let round = 0; round < 20; round++) {
      assert.equal(g.answer(), "____");
      g.type("abcdefghijklmnopqrstuvwxyz");
      g.$("next").click();
    }
  });
});
