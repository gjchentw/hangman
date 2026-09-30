import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { boot, voice } from "./helpers/boot.mjs";

// The order macOS actually reports: joke voices first, Albert at row 1. Albert
// is even flagged as the system default, to prove a novelty voice can never
// win the auto-pick - the bug that made TTS sound like a condemned man.
const MAC_VOICES = [
  voice("Albert", "en-US", { default: true }), voice("Bad News", "en-US"), voice("Bahh", "en-US"),
  voice("Bells", "en-US"), voice("Eddy", "en-US"), voice("Daniel", "en-GB"), voice("Karen", "en-AU"),
  voice("Moira", "en-IE"), voice("Samantha", "en-US"), voice("Zarvox", "en-US"),
  voice("Yuna", "ko-KR"), voice("Mei-Jia", "zh-TW"),
];
const last = (g) => g.spoken[g.spoken.length - 1];
const options = (g) => [...g.$("voice").querySelectorAll("option")].map((o) => o.value);

describe("voice selection", () => {
  let g;
  before(async () => { g = boot({ voices: MAC_VOICES }); await g.play("ability"); });
  after(() => g.close());

  test("auto-picks Samantha, not the first en-US voice", () => {
    g.$("say").click();
    assert.equal(last(g).voice, "Samantha");
    assert.match(g.$("say").title, /Samantha/);
  });

  test("lists every English voice, novelty ones included, and nothing else", () => {
    const opts = options(g);
    assert.equal(opts.length, 10);
    assert.ok(opts.includes("Bad News") && opts.includes("Zarvox"));
    assert.ok(!opts.includes("Yuna") && !opts.includes("Mei-Jia"));
  });

  test("groups recommended, plain and novelty voices", () => {
    const groups = [...g.$("voice").querySelectorAll("optgroup")]
      .map((group) => [group.label, [...group.children].map((o) => o.value)]);
    assert.deepEqual(groups.map(([label]) => label), ["建議", "其他英文語音", "特效語音"]);
    assert.equal(groups[0][1][0], "Samantha");
    assert.deepEqual(groups[1][1], ["Eddy"]);
    assert.ok(groups[2][1].includes("Albert") && groups[2][1].includes("Bad News"));
    assert.match(g.$("voice").querySelector("option").textContent, /美式/);
  });

  test("switching voice previews it and persists the choice", () => {
    g.$("voice").value = "Daniel";
    g.fire(g.$("voice"), "change");
    assert.equal(last(g).voice, "Daniel");
    assert.equal(g.stored("hangman:v1:voice").uri, "Daniel");
  });

  test("voiceschanged firing again does not clobber the choice", () => {
    g.speech.voicesChanged();
    g.speech.voicesChanged();
    g.$("say").click();
    assert.equal(last(g).voice, "Daniel");
    assert.equal(g.$("voice").value, "Daniel");
  });
});

describe("pitch and rate", () => {
  let g;
  before(async () => { g = boot({ voices: MAC_VOICES }); await g.play("ability"); });
  after(() => g.close());

  test("defaults are applied, and speech is cancelled before speaking", () => {
    g.$("say").click();
    assert.equal(last(g).pitch, 1);
    assert.equal(last(g).rate, 0.9);
    assert.ok(g.speech.cancels > 0);
  });

  test("dragging updates the label without speaking; releasing previews", () => {
    const before = g.spoken.length;
    g.$("rate").value = "1.5";
    g.fire(g.$("rate"), "input");
    assert.equal(g.$("rate-val").textContent, "1.50");
    assert.equal(g.spoken.length, before);
    g.fire(g.$("rate"), "change");
    assert.equal(last(g).rate, 1.5);
  });

  test("pitch applies alongside rate", () => {
    g.$("pitch").value = "1.8";
    g.fire(g.$("pitch"), "input");
    g.fire(g.$("pitch"), "change");
    assert.equal(last(g).pitch, 1.8);
    assert.equal(last(g).rate, 1.5);
  });

  test("settings survive into the next round", () => {
    g.type("abcdefghijklmnopqrstuvwxyz");
    g.$("next").click();
    g.$("say").click();
    assert.equal(last(g).pitch, 1.8);
    assert.equal(last(g).rate, 1.5);
  });

  test("reset restores defaults and the auto-picked voice", () => {
    g.$("voice-reset").click();
    assert.equal(g.$("pitch-val").textContent, "1.0");
    assert.equal(g.$("rate-val").textContent, "0.90");
    assert.equal(last(g).voice, "Samantha");
    assert.equal(g.stored("hangman:v1:voice").uri, null);
  });

  test("out-of-range values are clamped", () => {
    g.$("rate").value = "99";
    g.fire(g.$("rate"), "input");
    assert.equal(g.stored("hangman:v1:voice").rate, 2);
  });
});

describe("without speech support", () => {
  let g;
  before(async () => { g = boot(); await g.play("ability"); });
  after(() => g.close());

  test("every voice control is disabled and the panel dimmed", () => {
    for (const id of ["say", "voice", "pitch", "rate", "voice-reset"]) {
      assert.equal(g.$(id).disabled, true, `#${id} disabled`);
    }
    assert.ok(g.$("voice-ctl").classList.contains("off"));
    assert.ok(g.$("say").title.length > 0, "explains why");
  });
});
