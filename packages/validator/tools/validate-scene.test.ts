import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { didYouMean, isA } from "./classes.ts";
import type { SceneNode } from "./scene-node.ts";
import { RULES, validate } from "./validate-scene.ts";

import animatableNoShape from "../sample/fixtures/animatable-no-shape.ts";
import animatableWithShape from "../sample/fixtures/animatable-with-shape.ts";
import ballNoShape from "../sample/fixtures/ball-no-shape.ts";
import bodyNeedsShape from "../sample/fixtures/body-needs-shape.ts";
import clean from "../sample/fixtures/clean.ts";
import notANode from "../sample/fixtures/not-a-node.ts";
import notInstantiable from "../sample/fixtures/not-instantiable.ts";
import shapeNeedsBody from "../sample/fixtures/shape-needs-body.ts";
import shapeNeedsShapeProp from "../sample/fixtures/shape-needs-shape-prop.ts";
import spriteNeedsTexture from "../sample/fixtures/sprite-needs-texture.ts";
import scriptPropsNeedScript from "../sample/fixtures/script-props-need-script.ts";
import threeProblems from "../sample/fixtures/three-problems.ts";
import uniqueSiblingNames from "../sample/fixtures/unique-sibling-names.ts";
import unknownClass from "../sample/fixtures/unknown-class.ts";
import validName from "../sample/fixtures/valid-name.ts";

// ---- clean tree ------------------------------------------------------------------------------

test("a clean tree returns []", () => {
  assert.deepEqual(validate(clean), []);
});

// ---- one fixture per rule: exactly one issue, from exactly that rule ---------------------------

const perRule: { rule: string; severity: "error" | "warning"; tree: SceneNode; path: string; offender: (t: SceneNode) => SceneNode }[] = [
  { rule: "unique-sibling-names", severity: "error", tree: uniqueSiblingNames, path: "Dup", offender: (t) => t.children![1] },
  { rule: "valid-name", severity: "error", tree: validName, path: "a/b", offender: (t) => t.children![0] },
  { rule: "unknown-class", severity: "error", tree: unknownClass, path: "Oops", offender: (t) => t.children![0] },
  { rule: "not-a-node", severity: "error", tree: notANode, path: "Circle", offender: (t) => t.children![0] },
  { rule: "not-instantiable", severity: "error", tree: notInstantiable, path: "Item", offender: (t) => t.children![0] },
  { rule: "body-needs-shape", severity: "warning", tree: bodyNeedsShape, path: "Ball", offender: (t) => t.children![0] },
  { rule: "shape-needs-body", severity: "warning", tree: shapeNeedsBody, path: "Shape", offender: (t) => t.children![0] },
  { rule: "shape-needs-shape-prop", severity: "warning", tree: shapeNeedsShapeProp, path: "Wall/Shape", offender: (t) => t.children![0].children![0] },
  { rule: "sprite-needs-texture", severity: "warning", tree: spriteNeedsTexture, path: "Sprite", offender: (t) => t.children![0] },
  { rule: "script-props-need-script", severity: "warning", tree: scriptPropsNeedScript, path: "Enemy", offender: (t) => t.children![0] },
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

test("body-needs-shape: a CollisionPolygon2D child is enough, for every concrete CollisionObject2D type", () => {
  for (const type of ["CharacterBody2D", "RigidBody2D", "StaticBody2D", "Area2D", "AnimatableBody2D", "PhysicalBone2D"] as const) {
    const tree: SceneNode = { name: "R", type: "Node2D", children: [{ name: "B", type, children: [{ name: "P", type: "CollisionPolygon2D" }] }] };
    assert.deepEqual(validate(tree), [], type);
  }
});

test("shape-needs-body: a root CollisionShape2D (no parent) is reported", () => {
  const issues = validate({ name: "S", type: "CollisionShape2D", props: { shape: "rect" } });
  assert.deepEqual(issues.map((i) => [i.rule, i.path]), [["shape-needs-body", "."]]);
});

// ---- class hierarchy follow-up ---------------------------------------------------------------------

test("a shape under an AnimatableBody2D is fine (Godot accepts any CollisionObject2D parent)", () => {
  assert.deepEqual(validate(animatableWithShape), []);
});

test("an AnimatableBody2D with no shape gets the body-needs-shape warning", () => {
  const issues = validate(animatableNoShape);
  assert.deepEqual(issues.map((i) => [i.rule, i.severity, i.path]), [["body-needs-shape", "warning", "Platform"]]);
});

test("isA follows the inherits chain", () => {
  assert.ok(isA("AnimatableBody2D", "CollisionObject2D"));
  assert.ok(isA("AnimatableBody2D", "Node"));
  assert.ok(isA("Node2D", "Node2D"));
  assert.ok(!isA("Node2D", "AnimatableBody2D"));
  assert.ok(!isA("CircleShape2D", "Node"));
  assert.ok(!isA("NoSuchClass", "Node"));
  assert.ok(!isA("constructor", "Node")); // not a Godot class, even though every JS object has a "constructor"
});

test("unknown-class: the message suggests the closest class", () => {
  const [found] = validate(unknownClass);
  assert.equal(found.message, '"Node2Dd" is not a Godot class. Did you mean "Node2D"?');
});

test("didYouMean: case is ignored, far-off names get no suggestion, and only Node classes are suggested", () => {
  assert.equal(didYouMean("node2d"), "Node2D");
  assert.equal(didYouMean("CharcterBody2D"), "CharacterBody2D");
  assert.equal(didYouMean("Banana"), null);
  assert.equal(didYouMean("CircleShape2E"), null); // the near miss is a Resource, not something to put in a tree
});

test("unknown-class without a close match asks to check the spelling", () => {
  const [found] = validate({ name: "R", type: "Banana" } as unknown as SceneNode);
  assert.equal(found.rule, "unknown-class");
  assert.match(found.message, /Check the spelling/);
});

test("a type named like a JavaScript built-in is an unknown class", () => {
  for (const type of ["constructor", "toString", "__proto__"]) {
    assert.deepEqual(validate({ name: "R", type } as unknown as SceneNode).map((i) => i.rule), ["unknown-class"], type);
  }
});

test("not-a-node says what the class is, and what to do instead", () => {
  const [found] = validate(notANode);
  assert.match(found.message, /"CircleShape2D" is a Resource, not a Node/);
  assert.match(found.message, /"shape" prop of a CollisionShape2D/);
});

test("not-instantiable says it is abstract and names concrete alternatives", () => {
  const [found] = validate(notInstantiable);
  assert.match(found.message, /"CanvasItem" is abstract/);
  assert.match(found.message, /such as .*Node2D/);
});

test("each bad class type gives exactly one class issue (no double reporting)", () => {
  for (const tree of [unknownClass, notANode, notInstantiable]) {
    assert.equal(validate(tree).length, 1);
  }
});

test("every class in the generated NodeType union passes the class rules", () => {
  const generated = readFileSync(new URL("../src/node-types.gen.ts", import.meta.url), "utf8");
  const names = [...generated.matchAll(/^  \| "([A-Za-z0-9_]+)"$/gm)].map((m) => m[1]);
  assert.ok(names.length > 200, `only found ${names.length} names`);
  const classRules = ["unknown-class", "not-a-node", "not-instantiable"];
  for (const name of names) {
    const rules = validate({ name: "R", type: name } as unknown as SceneNode).map((i) => i.rule);
    assert.deepEqual(rules.filter((r) => classRules.includes(r)), [], name);
  }
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

test("script-props-need-script: script variables on a node with no script are reported", () => {
  const issues = validate({ name: "R", type: "Node2D", scriptProps: { speed: 1 } });
  assert.deepEqual(issues.map((i) => [i.rule, i.severity, i.path]), [["script-props-need-script", "warning", "."]]);
});

test("script-props-need-script: fine when the node has a script, or no scriptProps", () => {
  assert.deepEqual(validate({ name: "R", type: "Node2D", script: "res://scripts/a.gd", scriptProps: { speed: 1 } }), []);
  assert.deepEqual(validate({ name: "R", type: "Node2D", scriptProps: {} }), []);
});
