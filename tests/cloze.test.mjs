// The cloze game, driven through its built file against batch 001's content.
// fall's clozes all answer "fell", plan's all answer "plan", and expect's mix
// "expecting" with "expect" - which makes each case deterministic.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, voice } from "./helpers/boot.mjs";

const FILE = "hangman_cloze.html";
const inflections = JSON.parse(readFileSync(new URL("../tools/inflections.json", import.meta.url), "utf8"));
const formsOf = (w) => [w, ...Object.values(inflections[w].forms).flat()];
const setMode = (g, mode) => [...g.$("mode").children].find((b) => b.dataset.mode === mode).click();
const blank = (g) => g.$("defs").querySelector(".blank");

describe("a round with an inflected answer", () => {
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

  test("spelling the inflected form wins, and the result shows its base word", () => {
    g.type("fel");
    assert.equal(g.answer(), "fell");
    assert.equal(g.$("result-title").textContent, "答對了！");
    assert.equal(g.$("result-word").textContent, "fell ← fall");
  });

  test("once the round is over the sentence reads whole", () => {
    assert.equal(blank(g).textContent, "fell");
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

  test("spells the inflected form in order", () => {
    g.key("a");
    assert.equal(g.lives(), "5", "'a' is in the bank word but not the answer");
    g.type("fell");
    assert.equal(g.$("result-word").textContent, "fell ← fall");
  });
});

describe("pronunciation", () => {
  let g;
  before(async () => { g = boot({ file: FILE, voices: [voice("Samantha", "en-US")] }); await g.play("fall"); });
  after(() => g.close());

  test("says the answer, not the bank word", () => {
    g.key(" ");
    assert.equal(g.spoken.at(-1).text, "fell");
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
