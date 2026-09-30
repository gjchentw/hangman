import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot } from "./helpers/boot.mjs";

const PLAIN = "hangman.html";
const CLOZE = "hangman_cloze.html";
const src = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("each game embeds only its own data", () => {
  test("the cloze game carries neither dictionary", () => {
    assert.match(src(CLOZE), /const DICT_B64 = "";/);
    assert.match(src(CLOZE), /const ZH_B64 = "";/);
  });

  test("the definitions game carries no clozes", () => {
    assert.match(src(PLAIN), /const CLOZE_B64 = "";/);
  });
});

describe("the definitions game", () => {
  const g = boot({ file: PLAIN });
  after(() => g.close());

  test("is the plain variant with a language toggle", () => {
    assert.equal(g.doc.documentElement.dataset.variant, "plain");
    assert.equal(g.doc.title, "Hangman 單字遊戲");
    assert.ok(g.$("lang"), "#lang present");
  });
});

describe("the cloze game", () => {
  const g = boot({ file: CLOZE });
  after(() => g.close());

  test("is the cloze variant, titled as such", () => {
    assert.equal(g.doc.documentElement.dataset.variant, "cloze");
    assert.equal(g.doc.title, "Hangman 克漏字");
  });

  test("has no language toggle at all", () => {
    assert.equal(g.$("lang"), null);
  });

  test("lists a word with no cloze as unavailable and cannot start without one", async () => {
    await g.load("zzzqqq");
    assert.equal(g.$("count-ok").textContent, "0");
    assert.equal(g.$("play").disabled, true);
    assert.match(g.$("load-error").textContent, /克漏字/);
  });
});

describe("the two games keep separate state", () => {
  test("the cloze game saves under its own prefix", async () => {
    const g = boot({ file: CLOZE });
    try {
      await g.load("zzzqqq");
      assert.deepEqual(g.stored("hangman-cloze:v1:bank").words, ["zzzqqq"]);
      assert.equal(g.stored("hangman:v1:bank"), null);
    } finally {
      g.close();
    }
  });

  test("the cloze game does not offer the definitions game's bank", () => {
    const g = boot({ file: CLOZE, storage: { "hangman:v1:bank": { words: ["ability"], missing: [] } } });
    try {
      assert.equal(g.$("resume").hidden, true);
    } finally {
      g.close();
    }
  });

  test("the definitions game does not offer the cloze game's bank", () => {
    const g = boot({ file: PLAIN, storage: { "hangman-cloze:v1:bank": { words: ["ability"], missing: [] } } });
    try {
      assert.equal(g.$("resume").hidden, true);
    } finally {
      g.close();
    }
  });

  test("the voice preference is shared between them", () => {
    const g = boot({ file: CLOZE, storage: { "hangman:v1:voice": { pitch: 1.5, rate: 1.2, uri: null } } });
    try {
      assert.equal(g.$("pitch-val").textContent, "1.5");
      assert.equal(g.$("rate-val").textContent, "1.20");
    } finally {
      g.close();
    }
  });
});
