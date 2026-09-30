import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import type { SceneNode } from "./scene-node.ts";
import { RULES, validate } from "./validate-scene.ts";

import ballNoShape from "../sample/fixtures/ball-no-shape.ts";
import bodyNeedsShape from "../sample/fixtures/body-needs-shape.ts";
import clean from "../sample/fixtures/clean.ts";
import shapeNeedsBody from "../sample/fixtures/shape-needs-body.ts";
import shapeNeedsShapeProp from "../sample/fixtures/shape-needs-shape-prop.ts";
import spriteNeedsTexture from "../sample/fixtures/sprite-needs-texture.ts";
import threeProblems from "../sample/fixtures/three-problems.ts";
import uniqueSiblingNames from "../sample/fixtures/unique-sibling-names.ts";
import validName from "../sample/fixtures/valid-name.ts";

// ---- clean tree ------------------------------------------------------------------------------

test("a clean tree returns []", () => {
  assert.deepEqual(validate(clean), []);
});

// ---- one fixture per rule: exactly one issue, from exactly that rule ---------------------------

const perRule: { rule: string; severity: "error" | "warning"; tree: SceneNode; path: string; offender: (t: SceneNode) => SceneNode }[] = [
  { rule: "unique-sibling-names", severity: "error", tree: uniqueSiblingNames, path: "Dup", offender: (t) => t.children![1] },
  { rule: "valid-name", severity: "error", tree: validName, path: "a/b", offender: (t) => t.children![0] },
  { rule: "body-needs-shape", severity: "warning", tree: bodyNeedsShape, path: "Ball", offender: (t) => t.children![0] },
  { rule: "shape-needs-body", severity: "warning", tree: shapeNeedsBody, path: "Shape", offender: (t) => t.children![0] },
  { rule: "shape-needs-shape-prop", severity: "warning", tree: shapeNeedsShapeProp, path: "Wall/Shape", offender: (t) => t.children![0].children![0] },
  { rule: "sprite-needs-texture", severity: "warning", tree: spriteNeedsTexture, path: "Sprite", offender: (t) => t.children![0] },
];

for (const c of perRule) {
  test(`${c.rule}: its fixture triggers exactly that one issue`, () => {
    const issues = validate(c.tree);
    assert.equal(issues.length, 1, `expected 1 issue, got: ${issues.map((i) => i.rule).join(", ")}`);
    assert.equal(issues[0].rule, c.rule);
    assert.equal(issues[0].severity, c.severity);
    assert.equal(issues[0].path, c.path);
    assert.ok(issues[0].message.length > 20);
  });

  // PoC 4 needs to find the source position of the offending object, so it must be the same reference.
  test(`${c.rule}: issue.node is the same object as in the input tree`, () => {
    const [found] = validate(c.tree);
    assert.ok(found.node === c.offender(c.tree), "issue.node is not the input object (===)");
  });
}

test("every rule in RULES has a fixture above", () => {
  assert.equal(RULES.length, perRule.length);
});

// ---- the handover's named scenarios ------------------------------------------------------------

test("removing the Ball's CollisionShape2D gives one warning naming Ball", () => {
  const issues = validate(ballNoShape);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, "body-needs-shape");
  assert.equal(issues[0].path, "Ball");
});

test("three problems are all reported in one run", () => {
  const issues = validate(threeProblems);
  assert.deepEqual(issues.map((i) => i.rule).sort(), ["body-needs-shape", "unique-sibling-names", "valid-name"]);
});

// ---- a few edge cases of the rules -------------------------------------------------------------

test("valid-name: empty name, and every illegal character", () => {
  for (const name of ["", "a.b", "a:b", "a@b", "a/b", 'a"b', "a%b"]) {
    const issues = validate({ name: "Root", type: "Node2D", children: [{ name, type: "Node2D" }] });
    assert.deepEqual(issues.map((i) => i.rule), ["valid-name"], `name ${JSON.stringify(name)}`);
  }
});

test("body-needs-shape: a CollisionPolygon2D child is enough, for all four body types", () => {
  for (const type of ["CharacterBody2D", "RigidBody2D", "StaticBody2D", "Area2D"]) {
    const tree: SceneNode = { name: "R", type: "Node2D", children: [{ name: "B", type, children: [{ name: "P", type: "CollisionPolygon2D" }] }] };
    assert.deepEqual(validate(tree), [], type);
  }
});

test("shape-needs-body: a root CollisionShape2D (no parent) is reported", () => {
  const issues = validate({ name: "S", type: "CollisionShape2D", props: { shape: "rect" } });
  assert.deepEqual(issues.map((i) => [i.rule, i.path]), [["shape-needs-body", "."]]);
});

// ---- never throws --------------------------------------------------------------------------------

test("validate never throws on broken input", () => {
  const cycle: SceneNode = { name: "Loop", type: "Node2D", children: [] };
  cycle.children!.push(cycle);

  const broken: unknown[] = [
    null,
    undefined,
    42,
    {},
    { name: 5, type: "Node2D" },
    { name: "R", type: "Node2D", children: "nope" },
    { name: "R", type: "Node2D", children: [null, 7, { name: "ok", type: "Node2D" }] },
    cycle,
  ];
  broken.forEach((tree, i) => {
    assert.doesNotThrow(() => validate(tree as SceneNode), `broken input #${i}`);
    assert.ok(Array.isArray(validate(tree as SceneNode)), `broken input #${i}`);
  });
});

// ---- CLI -------------------------------------------------------------------------------------------

function cli(fixture: string) {
  const r = spawnSync(process.execPath, ["tools/validate-scene.ts", `sample/fixtures/${fixture}.ts`], { encoding: "utf8", cwd: new URL("..", import.meta.url) });
  return { code: r.status, out: r.stdout };
}

test("CLI: clean tree exits 0", () => {
  const r = cli("clean");
  assert.equal(r.code, 0);
  assert.match(r.out, /ok: no issues/);
});

test("CLI: warnings alone exit 0 and name the node", () => {
  const r = cli("ball-no-shape");
  assert.equal(r.code, 0);
  assert.match(r.out, /^warning: Ball: /m);
});

test("CLI: any error exits non-zero", () => {
  assert.equal(cli("valid-name").code, 1);
  assert.equal(cli("three-problems").code, 1);
});
