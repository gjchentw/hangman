// The cloze validator is what stands between an authoring mistake and a
// player, so each of its rules has a fixture that must trip it.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FIXTURES = "tests/fixtures/cloze";

function run(...args) {
  const r = spawnSync("python3", ["tools/build_cloze.py", ...args], { encoding: "utf8" });
  if (r.error) throw r.error;
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const validate = (dir) => {
  const r = run("--dir", dir, "--json");
  return { code: r.code, ...JSON.parse(r.out) };
};
const todo = (dir, n, only) =>
  run("--dir", dir, "--todo", String(n), "--only", only).out.trim().split("\n").filter(Boolean).map(JSON.parse);

describe("clozes that follow the rules", () => {
  test("pass, and the run exits 0", () => {
    const r = validate(`${FIXTURES}/good`);
    assert.equal(r.code, 0);
    assert.equal(r.valid, 5);
    assert.deepEqual(r.rejects, []);
  });
});

describe("clozes that break a rule", () => {
  const fixtures = JSON.parse(readFileSync(`${FIXTURES}/bad/001.json`, "utf8"));
  const r = validate(`${FIXTURES}/bad`);
  const byIndex = new Map(r.rejects.map((x) => [x.index, x.code]));

  test("fail the run", () => assert.equal(r.code, 1));

  fixtures.forEach((entry, index) => {
    const want = entry._expect;
    test(`#${index} ${entry.w}: ${want ?? "valid"}`, () => {
      assert.equal(byIndex.get(index) ?? null, want);
    });
  });
});

describe("the worklist", () => {
  const authored = JSON.parse(readFileSync(`${FIXTURES}/good/001.json`, "utf8"));
  const done = new Set(authored.map((e) => `${e.w}/${e.id}`));
  const items = todo(`${FIXTURES}/good`, 50, "expect,fall,mind,plan,quick");

  test("never repeats a sense already written", () => {
    for (const item of items) assert.ok(!done.has(`${item.w}/${item.id}`), `${item.w}/${item.id}`);
  });

  test("never takes a word past 3 clozes", () => {
    for (const w of ["expect", "fall", "mind", "plan", "quick"]) {
      const had = authored.filter((e) => e.w === w).length;
      const proposed = items.filter((i) => i.w === w).length;
      assert.ok(had + proposed <= 3, `${w}: ${had} written + ${proposed} proposed`);
    }
  });

  test("never offers a sense whose definition gives the word away", () => {
    const ids = new Set(items.map((i) => i.id));
    assert.ok(!ids.has("5395cfb5e9"), "fall: 'fall to somebody by assignment'");
    assert.ok(!ids.has("72f65845a4"), "quick: 'moving quickly and lightly'");
  });

  test("lists the forms each sense's part of speech allows", () => {
    const expect = items.find((i) => i.w === "expect");
    assert.deepEqual(expect.forms, ["expect", "expected", "expecting", "expects"]);
  });
});
