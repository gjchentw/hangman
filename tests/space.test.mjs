import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, voice } from "./helpers/boot.mjs";

const VOICES = [voice("Samantha", "en-US", { default: true })];
const setMode = (g, mode) => [...g.$("mode").children].find((b) => b.dataset.mode === mode).click();

describe("Space during a round", () => {
  let g;
  before(async () => { g = boot({ voices: VOICES }); await g.play("ability"); });
  after(() => g.close());

  test("speaks the word and costs nothing", () => {
    const event = g.key(" ");
    assert.equal(g.spoken.length, 1);
    assert.equal(g.spoken[0].text, "ability");
    assert.equal(g.answer(), "_______");
    assert.equal(g.lives(), "6");
    assert.ok(event.defaultPrevented, "blocks the native button activation");
  });

  test("can be pressed repeatedly", () => {
    g.key(" ");
    g.key(" ");
    assert.equal(g.spoken.length, 3);
    assert.equal(g.lives(), "6");
  });

  test("leaves letter guessing alone", () => {
    g.key("i");
    assert.equal(g.answer(), "__i_i__");
  });
});

// In strict mode on-screen keys stay enabled, so a clicked key keeps focus.
// Without preventDefault, Space would re-fire it and cost a life.
describe("Space after clicking an on-screen key in strict mode", () => {
  let g;
  before(async () => { g = boot({ voices: VOICES }); await g.play("ability"); setMode(g, "strict"); });
  after(() => g.close());

  test("speaks once without re-submitting the key", () => {
    g.keyButton("a").click();
    assert.equal(g.answer(), "a______");
    const count = g.spoken.length;
    const event = g.key(" ");
    assert.ok(event.defaultPrevented);
    assert.equal(g.spoken.length, count + 1);
    assert.equal(g.lives(), "6");
    assert.equal(g.answer(), "a______");
  });
});

describe("Space outside a round", () => {
  let g;
  before(async () => { g = boot({ voices: VOICES }); await g.play("ability"); });
  after(() => g.close());

  test("advances to the next round once this one is over", () => {
    g.type("abilty");
    assert.ok(g.roundOver());
    const event = g.key(" ");
    assert.equal(g.roundOver(), false);
    assert.ok(event.defaultPrevented);
    assert.equal(g.answer(), "_______");
  });

  test("does nothing on the setup screen", () => {
    g.$("quit").click();
    const count = g.spoken.length;
    g.key(" ");
    assert.equal(g.spoken.length, count);
  });
});
