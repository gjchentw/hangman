import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

const langButton = (g, lang) => [...g.$("lang").children].find((b) => b.dataset.lang === lang);
const defs = (g) => g.$("defs").textContent;

describe("definition language", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); });
  after(() => g.close());

  test("defaults to 中文", () => {
    assert.match(defs(g), /能力/);
    assert.ok(langButton(g, "zh").classList.contains("on"));
    assert.doesNotMatch(defs(g), /[a-z]{5,}/, "no English sentences in the Chinese view");
  });

  test("EN shows the English definitions", () => {
    langButton(g, "en").click();
    assert.match(defs(g), /the quality of being able to perform/);
    assert.doesNotMatch(defs(g), /能力/);
    assert.ok(langButton(g, "en").classList.contains("on"));
  });

  test("both views badge the part of speech", () => {
    assert.ok([...g.$("defs").querySelectorAll(".pos")].some((e) => e.textContent === "noun"));
    langButton(g, "zh").click();
    assert.ok([...g.$("defs").querySelectorAll(".pos")].some((e) => e.textContent === "n."));
  });

  test("switching mid-round leaves the round untouched", () => {
    g.type("iz");
    langButton(g, "en").click();
    langButton(g, "zh").click();
    assert.equal(g.answer(), "__i_i__");
    assert.equal(g.lives(), "5");
    assert.ok(g.keyButton("i").classList.contains("hit"));
  });
});

// The invariant the variant split must preserve: the 釋義版 shows EVERY sense.
describe("EN lists every sense", () => {
  let g;
  before(async () => { g = boot(); await g.play("cat"); langButton(g, "en").click(); });
  after(() => g.close());

  test("cat shows all 9 of its wordset senses", () => {
    assert.equal(g.$("defs").children.length, 9);
    assert.equal(g.$("defs").querySelector(".cloze"), null, "no cloze in the definitions game");
  });
});

describe("Taiwan usage reaches the screen", () => {
  let g;
  before(() => { g = boot(); });
  after(() => g.close());

  for (const [word, want, avoid] of [
    ["computer", "電腦", "計算機"],
    ["missile", "飛彈", "導彈"],
    ["panda", "貓熊", "熊貓"],
    ["motorcycle", "機車", "摩托車"],
  ]) {
    test(`${word}: ${want}, not ${avoid}`, async () => {
      await g.play(word);
      assert.match(defs(g), new RegExp(want));
      assert.doesNotMatch(defs(g), new RegExp(avoid));
    });
  }

  test("a hand-translated word renders", async () => {
    await g.play("chupacabra");
    assert.match(defs(g), /卓柏卡布拉/);
  });
});

describe("the language choice persists", () => {
  test("a stored EN choice reopens in EN", async () => {
    const g = boot({ storage: { "hangman:v1:lang": "en" } });
    try {
      await g.play("ability");
      assert.match(defs(g), /the quality of being able/);
      assert.ok(langButton(g, "en").classList.contains("on"));
    } finally {
      g.close();
    }
  });

  test("toggling stores the choice", async () => {
    const g = boot();
    try {
      await g.play("ability");
      langButton(g, "en").click();
      assert.equal(g.stored("hangman:v1:lang"), "en");
    } finally {
      g.close();
    }
  });
});
