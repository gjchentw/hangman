import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { boot, until } from "./helpers/boot.mjs";

describe("resuming a saved word bank", () => {
  const g = boot({
    storage: {
      "hangman:v1:bank": { words: ["ability", "serendipity", "zzzqqq"], missing: ["zzzqqq"], savedAt: "2026-01-01T00:00:00Z" },
      "hangman:v1:stats": { played: 4, won: 3, lost: 1 },
    },
  });
  after(() => g.close());

  test("offers the saved bank with its size", () => {
    assert.equal(g.$("resume").hidden, false);
    assert.match(g.$("resume").textContent, /3 個字/);
  });

  test("re-resolves the saved words", async () => {
    g.$("resume").click();
    await until(() => !g.$("load-result").hidden, "resume load");
    assert.equal(g.$("count-ok").textContent, "2");
    assert.equal(g.$("count-no").textContent, "1");
  });

  test("restores the previous stats", () => {
    g.$("play").click();
    assert.match(g.$("scoreline").textContent, /已完成 4 題 · 答對 3 · 答錯 1/);
  });
});

describe("a first visit", () => {
  const g = boot();
  after(() => g.close());

  test("has nothing to resume", () => {
    assert.equal(g.$("resume").hidden, true);
  });
});
