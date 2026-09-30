import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

const setMode = (g, mode) => [...g.$("mode").children].find((b) => b.dataset.mode === mode).click();
const modeOn = (g, mode) => [...g.$("mode").children].find((b) => b.dataset.mode === mode).classList.contains("on");
const cursorAt = (g) => [...g.$("answer").children].findIndex((e) => e.className === "cursor");

describe("easy mode", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); });
  after(() => g.close());

  test("is the default", () => assert.ok(modeOn(g, "easy")));

  test("reveals every matching position", () => {
    g.key("i");
    assert.equal(g.answer(), "__i_i__");
  });
});

describe("strict mode", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); setMode(g, "strict"); });
  after(() => g.close());

  test("an out-of-order letter reveals nothing and costs a life", () => {
    assert.ok(modeOn(g, "strict"));
    g.key("i");
    assert.equal(g.answer(), "_______");
    assert.equal(g.lives(), "5");
  });

  test("letters in spelling order reveal one position at a time", () => {
    g.type("abi");
    assert.equal(g.answer(), "abi____");
    assert.equal(g.lives(), "5");
  });

  test("a letter can be used again later in the word", () => {
    assert.equal(g.keyButton("i").disabled, false);
    assert.equal(g.keyButton("i").classList.contains("hit"), false);
    g.type("li");
    assert.equal(g.answer(), "abili__");
  });

  test("the caret marks the next position", () => {
    assert.equal(cursorAt(g), 5);
  });

  test("switching to easy keeps the progress", () => {
    setMode(g, "easy");
    assert.equal(g.answer(), "abili__");
    assert.equal(g.lives(), "5");
    assert.equal(cursorAt(g), -1);
    g.type("ty");
    assert.equal(g.$("result-title").textContent, "答對了！");
  });
});

describe("switching easy to strict mid-word", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); g.type("ab"); setMode(g, "strict"); });
  after(() => g.close());

  test("keeps the progress and resumes at the first hidden position", () => {
    assert.equal(g.answer(), "ab_____");
    assert.equal(cursorAt(g), 2);
    g.key("i");
    assert.equal(g.answer(), "abi____");
  });

  test("easy-mode key state returns when switching back", () => {
    setMode(g, "easy");
    assert.ok(g.keyButton("a").classList.contains("hit"));
    assert.equal(g.keyButton("a").disabled, true);
    setMode(g, "strict");
    assert.equal(g.keyButton("a").disabled, false);
  });
});

describe("strict mode edge cases", () => {
  let g;
  before(() => { g = boot(); });
  after(() => g.close());

  test("six wrong keys lose the round", async () => {
    await g.play("ability");
    setMode(g, "strict");
    g.type("zzzzzz");
    assert.equal(g.$("result-title").textContent, "可惜，機會用完了");
    assert.equal(g.answer(), "ability");
    assert.equal(g.doc.querySelectorAll(".part.show").length, 6);
  });

  test("the caret skips a hyphen", async () => {
    await g.play("acid-forming");
    setMode(g, "strict");
    assert.equal(g.answer(), "____-_______");
    g.type("acidf");
    assert.equal(g.answer(), "acid-f______");
  });
});

describe("the mode persists", () => {
  test("a stored strict choice reopens in strict mode", async () => {
    const g = boot({ storage: { "hangman:v1:mode": "strict" } });
    try {
      await g.play("ability");
      assert.ok(modeOn(g, "strict"));
      g.key("i");
      assert.equal(g.answer(), "_______");
    } finally {
      g.close();
    }
  });
});
