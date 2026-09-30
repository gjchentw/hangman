import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers/boot.mjs";

describe("setup and loading", () => {
  let g;
  before(() => { g = boot(); });
  after(() => g.close());

  test("opens on the setup screen", () => {
    assert.ok(g.$("setup").classList.contains("active"));
  });

  test("an empty bank is refused on the setup screen", () => {
    g.$("bank-input").value = "  ,\n ";
    g.$("start").click();
    assert.equal(g.$("setup-error").hidden, false);
    assert.ok(g.$("setup").classList.contains("active"));
  });

  test("comma, space and newline all separate words; unknown words are listed", async () => {
    await g.load("ability,zzzqqq serendipity\nhangman");
    assert.equal(g.$("count-ok").textContent, "3");
    assert.equal(g.$("count-no").textContent, "1");
    assert.equal(g.$("missing-list").textContent, "zzzqqq");
    assert.equal(g.$("play").disabled, false);
  });

  test("case and duplicates are normalised", async () => {
    await g.load("ABILITY ability Ability");
    assert.equal(g.$("count-ok").textContent, "1");
    assert.equal(g.$("count-no").textContent, "0");
  });

  test("a bank with no known words cannot start", async () => {
    await g.load("zzzqqq,wwwvvv");
    assert.equal(g.$("count-ok").textContent, "0");
    assert.equal(g.$("play").disabled, true);
    assert.equal(g.$("load-error").hidden, false);
  });
});

describe("guessing in easy mode", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); });
  after(() => g.close());

  test("the word starts fully masked", () => {
    assert.equal(g.answer(), "_______");
    assert.equal(g.lives(), "6");
  });

  test("a correct letter reveals every occurrence and costs nothing", () => {
    g.key("i");
    assert.equal(g.answer(), "__i_i__");
    assert.equal(g.lives(), "6");
    assert.ok(g.keyButton("i").classList.contains("hit"));
  });

  test("a wrong letter costs a life and draws a body part", () => {
    g.key("z");
    assert.equal(g.lives(), "5");
    assert.equal(g.doc.querySelectorAll(".part.show").length, 1);
    assert.ok(g.keyButton("z").classList.contains("miss"));
  });

  test("repeating a letter is ignored", () => {
    g.key("z");
    g.key("i");
    assert.equal(g.lives(), "5");
  });

  test("an on-screen key guesses like a physical one", () => {
    g.keyButton("a").click();
    assert.equal(g.answer(), "a_i_i__");
  });

  test("completing the word wins the round", () => {
    g.type("blty");
    assert.ok(g.roundOver());
    assert.equal(g.$("result-title").textContent, "答對了！");
    assert.equal(g.answer(), "ability");
    assert.equal(g.$("play-area").hidden, true);
    assert.match(g.$("scoreline").textContent, /答對 1/);
  });
});

describe("losing", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); g.type("zqxjkw"); });
  after(() => g.close());

  test("six misses end the round", () => {
    assert.ok(g.roundOver());
    assert.equal(g.$("result-title").textContent, "可惜，機會用完了");
    assert.equal(g.lives(), "0");
  });

  test("the whole figure is drawn and the answer revealed", () => {
    assert.equal(g.doc.querySelectorAll(".part.show").length, 6);
    assert.equal(g.answer(), "ability");
    assert.equal(g.$("result-word").textContent, "ability");
    assert.ok(g.$("answer").querySelector(".miss"), "unguessed letters are marked");
  });
});

describe("between rounds", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); g.type("abilty"); });
  after(() => g.close());

  test("letters do nothing once the round is over", () => {
    g.key("q");
    assert.ok(g.roundOver());
    assert.equal(g.lives(), "6");
  });

  test("Enter starts the next round", () => {
    g.key("Enter");
    assert.equal(g.roundOver(), false);
    assert.equal(g.answer(), "_______");
  });

  test("the 下一題 button starts the next round", () => {
    g.type("abilty");
    g.$("next").click();
    assert.equal(g.roundOver(), false);
    assert.equal(g.answer(), "_______");
  });
});

describe("the word pool", () => {
  let g;
  before(() => { g = boot(); });
  after(() => g.close());

  test("a hyphen is shown from the start", async () => {
    await g.play("acid-forming");
    assert.equal(g.answer(), "____-_______");
  });

  test("a word missing from the dictionary is never drawn", async () => {
    await g.play("ability,zzzqqq");
    for (let round = 0; round < 30; round++) {
      assert.equal(g.answer().length, "ability".length);
      g.type("abcdefghijklmnopqrstuvwxyz");
      g.$("next").click();
    }
  });
});

describe("the on-screen keyboard", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); });
  after(() => g.close());

  test("is laid out QWERTY, every letter once", () => {
    const rows = [...g.$("keys").querySelectorAll(".krow")]
      .map((row) => [...row.children].map((b) => b.dataset.letter).join(""));
    assert.deepEqual(rows, ["qwertyuiop", "asdfghjkl", "zxcvbnm"]);
  });
});

describe("persistence", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); g.type("abilty"); });
  after(() => g.close());

  test("the word bank and stats are saved", () => {
    assert.deepEqual(g.stored("hangman:v1:bank").words, ["ability"]);
    assert.equal(g.stored("hangman:v1:stats").won, 1);
  });
});
