# Handover: scene tree validator (PoC 3)

Sep 30, 2026 · @HUMONGOUSCOCKOUS

## Context and goal

Write a plain function that walks a declarative scene tree and returns a list of problems, each with a clear human-written message. Structural rules live here, in ordinary code, instead of in the type system.

This is the third of four separate proofs of concept. It checks the same `SceneNode` data that PoC 2 emits, catching mistakes Godot would otherwise flag later as configuration warnings (e.g. a CharacterBody2D with no collision shape).

PoC 4 will show these problems as editor squiggles, so each issue must point back to the exact node object that caused it. Design for that now, but build no editor integration here.

## Scope and constraints

In scope:

- `validate(root: SceneNode): Issue[]` that never throws; an empty array means the tree is clean.
- Rules as a plain array of small functions, so adding one is adding one function.
- A CLI that loads a tree definition file, prints issues as `Ball/Sprite: message`, and exits non-zero on any error.
- Unit tests with `node:test`, one fixture tree per rule.

Out of scope:

- Emitting .tscn files (PoC 2) or editor squiggles (PoC 4).
- Reading a Godot class hierarchy, or checking that a script's `extends` matches its node type. Note it as a possible next step.
- Type-level enforcement of any of these rules.

Constraints: Node built-ins only, under roughly 200 lines excluding tests, time-boxed to about two hours. Same SceneNode type as PoC 2; stub it if PoC 2 isn't done. Write SESSION.md with intent, tasks, completed work, findings and next steps.

## Deliverables, issue shape and starting rules

Deliver `tools/validate-scene.ts`, `tools/validate-scene.test.ts`, fixture trees under `sample/fixtures/`, and SESSION.md.

```ts
type Issue = {
  severity: "error" | "warning";
  rule: string;          // e.g. "body-needs-shape"
  path: string;          // "Ball/Sprite", root-relative
  message: string;       // written for a human, says how to fix it
  node: SceneNode;       // the exact object, so PoC 4 can find its source position
};

type Rule = (node: SceneNode, parent: SceneNode | null) => Issue[];
```

Start with these rules, then add more only if they're obvious:

| Rule | Severity | Fires when |
| --- | --- | --- |
| unique-sibling-names | error | Two children of one node share a name |
| valid-name | error | A name is empty or contains `. : @ / " %` |
| body-needs-shape | warning | CharacterBody2D, RigidBody2D, StaticBody2D or Area2D has no CollisionShape2D or CollisionPolygon2D child |
| shape-needs-body | warning | CollisionShape2D's parent is not one of those four types |
| shape-needs-shape-prop | warning | CollisionShape2D has no `shape` prop |
| sprite-needs-texture | warning | Sprite2D has no `texture` prop |

The warning rules mirror Godot's own configuration warnings; keep the messages close to Godot's wording so they're recognizable.

## Acceptance criteria

Done means each check runs by hand and behaves as described, with actual output recorded in SESSION.md.

- [ ] A clean sample tree returns `[]` and the CLI exits 0.
- [ ] Each rule has a fixture that triggers exactly that one issue, and `node --test` passes.
- [ ] Removing the CollisionShape2D from the Ball body prints one readable warning naming `Ball`.
- [ ] A tree with three problems reports all three in one run, not just the first.
- [ ] `issue.node` is the same object reference as the node in the input tree (checked with `===` in a test).
- [ ] For one fixture, emit it with PoC 2, open it in the Godot editor, and note whether Godot shows the same warning. Record matches and mismatches.
