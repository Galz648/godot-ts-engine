# PoC 3 session: scene tree validator

Date: 2026-09-30. Spec: `pocs/Handover scene tree validator (PoC 3).md`. Built standalone; PoC 2 was not read or imported.

## Intent

Structural scene rules (shapes, unique names, valid names) as a plain `validate(root): Issue[]` over a declarative tree,
with messages written for a human, instead of type-level enforcement. Every issue keeps a reference to the exact input
object so PoC 4 can turn it into an editor squiggle.

## Tasks

1. Bun project in `pocs/poc3-validator/` (`package.json`, `tsconfig.json`, TypeScript `~5.9`, `@types/node` for `tsc` only).
2. `tools/scene-node.ts`: local **stub** of the `SceneNode` type PoC 2 will provide.
3. `tools/validate-scene.ts` (147 lines): `Issue`, `Rule`, six rules in a `RULES` array, `validate()`, and a small CLI.
4. `sample/fixtures/*.ts`: one tree per rule, plus `clean`, `ball-no-shape`, `three-problems`.
5. `tools/validate-scene.test.ts` (`node:test`, 23 tests).
6. `sample/godot-check/`: a tiny Godot project with hand-written scenes, for the Godot comparison.
7. Run every acceptance check by hand; record below.

## Completed

Checks 1-5 pass. **Check 6 (look at it in the Godot editor)** could not be run by the agent that built this, and was later run
by hand by the user in the Godot 4.7.2 editor: see check 6 below.

## Acceptance checks (actual commands and output)

Run from `pocs/poc3-validator/`. Node v24.1.0 (runs `.ts` directly by type stripping); the CLI also runs under `bun`.
Output filtered with `grep -v ExperimentalWarning`.

**1. Clean tree returns `[]` and the CLI exits 0**: PASS.

```
$ node tools/validate-scene.ts sample/fixtures/clean.ts
ok: no issues
[exit 0]
```
The test `a clean tree returns []` asserts `validate(clean)` deep-equals `[]`.

**2. Each rule has a fixture that triggers exactly that one issue; `node --test` passes**: PASS.

```
$ node --test tools/validate-scene.test.ts
ℹ tests 23
ℹ pass 23
ℹ fail 0
```
Per rule there are two tests, "its fixture triggers exactly that one issue" (length 1, right rule, severity and path) and
"issue.node is the same object". Per-fixture CLI output:

```
$ node tools/validate-scene.ts sample/fixtures/unique-sibling-names.ts
error: Dup: Another child of "Level" is already called "Dup". Sibling names must be unique; rename one of them.   [exit 1]
$ node tools/validate-scene.ts sample/fixtures/valid-name.ts
error: a/b: The name "a/b" contains "/", which Godot does not allow in node names (not allowed: . : @ / " %). Rename it.   [exit 1]
$ node tools/validate-scene.ts sample/fixtures/body-needs-shape.ts
warning: Ball: This node has no shape, so it can't collide or interact with other objects. Consider adding a CollisionShape2D or CollisionPolygon2D as a child to define its shape.   [exit 0]
$ node tools/validate-scene.ts sample/fixtures/shape-needs-body.ts
warning: Shape: CollisionShape2D only serves to provide a collision shape to a CollisionObject2D derived node. Please only use it as a child of Area2D, StaticBody2D, RigidBody2D, CharacterBody2D, etc. to give them a shape.   [exit 0]
$ node tools/validate-scene.ts sample/fixtures/shape-needs-shape-prop.ts
warning: Wall/Shape: A shape must be provided for CollisionShape2D to function. Please create a shape resource for it! (Set the "shape" prop.)   [exit 0]
$ node tools/validate-scene.ts sample/fixtures/sprite-needs-texture.ts
warning: Sprite: This Sprite2D has no texture, so nothing will be drawn. Set the "texture" prop.   [exit 0]
```

**3. Removing the Ball's CollisionShape2D prints one readable warning naming `Ball`**: PASS.

```
$ node tools/validate-scene.ts sample/fixtures/ball-no-shape.ts
warning: Ball: This node has no shape, so it can't collide or interact with other objects. Consider adding a CollisionShape2D or CollisionPolygon2D as a child to define its shape.
0 error(s), 1 warning(s)
[exit 0]
```

**4. Three problems are all reported in one run**: PASS.

```
$ node tools/validate-scene.ts sample/fixtures/three-problems.ts
warning: Ball: This node has no shape, so it can't collide or interact with other objects. ...
error: Dup: Another child of "Level" is already called "Dup". Sibling names must be unique; rename one of them.
error: bad:name: The name "bad:name" contains ":", which Godot does not allow in node names (not allowed: . : @ / " %). Rename it.
2 error(s), 1 warning(s)
[exit 1]
```

**5. `issue.node` is the same object reference as the node in the input tree (`===`)**: PASS. The six
"issue.node is the same object as in the input tree" tests use `assert.ok(issue.node === <object from the input tree>)`.

**6. Emit a fixture with PoC 2, open it in the Godot editor, note whether Godot shows the same warning**: PASS for the five
scenes in `sample/godot-check/`, run by hand by the user in the Godot 4.7.2 editor. The user reported that the predictions
in the table below were correct: `clean.tscn` no warning; `ball-no-shape.tscn` a warning on Ball;
`shape-needs-shape-prop.tscn` and `shape-needs-body.tscn` a warning on Shape; `sprite-needs-texture.tscn` NO warning
(the validator's `sprite-needs-texture` rule is not a Godot warning). The hover text of the triangles was not reported, so
the message wording was not compared. The AnimatableBody2D case (below) was tested afterwards with `godot-check/animatable-with-shape.tscn` and
`animatable-no-shape.tscn` (fixtures `sample/fixtures/animatable-*.ts`): the user saw NO warning on the first and a warning on
`Platform` in the second. The validator does the opposite on both (warns on the first: false alarm; "ok: no issues" on the
second: missed warning), so the source-based prediction is confirmed by observation.
The agent's own notes from before that run (it had no way to look at the editor) follow.

- PoC 2 is not available to me, so I wrote the `.tscn` files by hand in `sample/godot-check/` (same shape the emitter
  would write). They are an approximation of PoC 2's output, not its output.
- I opened `ball-no-shape.tscn` in Godot 4.7.2 (`godot --editor --path sample/godot-check ball-no-shape.tscn`; it started
  fine and I then closed it). I **could not look at it**: `screencapture -x` fails here with
  `could not create image from display`, and Godot does not expose `get_configuration_warnings()` to scripts
  (`Nonexistent function 'get_configuration_warnings' in base 'Node2D'`, seen earlier in this project on 4.7.2).
  So I have **no observation of what the editor shows**.
- What I did instead: read Godot's source at tag `4.7.2-stable` (`collision_object_2d.cpp`, `collision_shape_2d.cpp`,
  `sprite_2d.cpp`). That shows what Godot *should* warn, not what I saw. Matches and mismatches from that source read:

| Rule | Godot 4.7.2 (source) | Verdict |
| --- | --- | --- |
| body-needs-shape | `CollisionObject2D::get_configuration_warnings`: warns when it has no shape owner, same text | **match** for the four types, but Godot applies it to every CollisionObject2D (e.g. AnimatableBody2D) |
| shape-needs-shape-prop | `CollisionShape2D`: warns when `shape.is_null()`, same text | **match** |
| shape-needs-body | `CollisionShape2D`: warns when the parent is not a `CollisionObject2D` (any subclass) | **partial**: same text, but ours only accepts the four listed types, so e.g. a shape under AnimatableBody2D is a false positive here |
| sprite-needs-texture | `sprite_2d.cpp` has no configuration-warning code | **mismatch**: Godot shows no warning for a Sprite2D without a texture. The rule is in the handover but is not a Godot warning |

- Godot also has warnings we don't implement: One Way Collision on an Area2D, and polygon-based shapes on CollisionShape2D.
- Godot's two-sentence warnings separate the sentences with a newline; ours use a space.
- **Editor run:** the user opened `ball-no-shape.tscn`, `shape-needs-body.tscn`, `shape-needs-shape-prop.tscn`,
  `sprite-needs-texture.tscn` and `clean.tscn` and reported the source-based predictions above were correct.

## Findings and surprises

- **Node runs the TypeScript directly** (v24.1 type stripping), so `node --test` and the CLI work on `.ts`. Consequences:
  imports need the `.ts` extension, types need `import type`, and `tsconfig` needs `allowImportingTsExtensions`.
  Node prints an ExperimentalWarning for this.
- **Godot counts a CollisionShape2D child as enough for "has a shape"**, even if that child has no shape resource (the
  body's shape owner exists from the moment the child is parented); the child then gets its own warning. Our rules
  behave the same way (checked in the source, and in the tests where the shape child has no `shape` prop).
- **Rule signature vs. path.** `Rule = (node, parent) => Issue[]` can't know a node's path, so rules return `path: ""`
  and `validate()` fills it in after each rule returns.
- One test of mine failed at first because its assertion message called `JSON.stringify` on a circular tree. A test
  bug, not a validator bug; fixed.

## Decisions to review

1. **`SceneNode` stub** (`name`, `type`, `props?`, `script?`, `children?`) is my guess; PoC 2 may differ.
2. **Path format:** the root is `"."`; children are relative to the root without its name, so `Ball/Sprite`, not `Level/Ball/Sprite`.
   An unnamed node shows as `<unnamed>`.
3. **CLI output** is `severity: path: message`, then a summary line. The handover says `path: message`; I added the severity
   prefix so warnings and errors are distinguishable. Exit 0 for warnings only, 1 for any error, 2 for usage or load failure.
4. **Duplicate names:** the issue is on the *second and later* node with that name (the one to rename), not on the parent.
5. **`never throws`:** a crashing rule, a non-node child, or a non-object root becomes an `internal-error` issue;
   a node that contains itself is visited once. Not in the handover, small.
6. **`shape-needs-body` uses the four types from the handover**, not "any CollisionObject2D" (see the table). Kept to the spec.
7. **Tree files are `.ts` modules with a default export** (not JSON), so PoC 4 can later find source positions.
8. **`@types/node`** is a devDependency so `tsc` can check the tools; there are no runtime dependencies.

## Not done

- Godot hover-text wording was not compared (check 6). The validator's hardcoded four body types are not fixed; the
  AnimatableBody2D false alarm and missed warning are confirmed but left as they are (needs Godot's class hierarchy).
- No Windows run. The code has no path handling beyond `resolve`/`pathToFileURL`.
- No rule for CollisionPolygon2D parents, the `extends` check, or class-hierarchy checks (out of scope per the handover;
  a hierarchy would also fix the AnimatableBody2D false positive).

## Next steps

- Look at the four warning scenes in the Godot editor and fill in the observed column of the table above.
- Decide whether `sprite-needs-texture` stays (it is not a Godot warning) and whether `shape-needs-body` should accept any
  CollisionObject2D once a class hierarchy is available.
- PoC 4: call `validate()` from a language service plugin and map `issue.node` to its source position.

## Class hierarchy follow-up

Goal: stop hardcoding four body types, use Godot's own class hierarchy instead, and catch class-name typos. The Godot
editor side of the AnimatableBody2D problem (false alarm on a shape under it; missed warning when it has no shape) was
already observed by the user in the editor earlier in this session. This follow-up only checked the validator side, by
CLI and tests; nothing here was opened in the editor.

### What was added

- `tools/gen-classes.ts` (77 lines, Node built-ins only). Runs `godot --headless --dump-extension-api` in a temp folder
  (removed afterwards; the 7 MB dump never enters the repo) and writes two small files, only if their text changed:
  `data/classes.json` (class -> `{ inherits, instantiable }`, one class per line, 83,295 bytes) and
  `src/node-types.gen.ts` (`NodeType`, a union of every instantiable class that descends from `Node`, 5,535 bytes).
  Options: `--godot <binary>`, `--api <existing extension_api.json>`. Script: `npm run gen-classes`.
- `tools/classes.ts` (69 lines): `exists`, `isA(type, ancestor)` (walks the `inherits` chain), `isInstantiable`,
  `familyOf`, `concreteSubclasses`, and `didYouMean` (plain edit distance, at most 2 edits, case ignored, only suggests
  instantiable Node classes).
- `tools/validate-scene.ts` (now 177 lines): `body-needs-shape`, `shape-needs-body` and `shape-needs-shape-prop` use
  `isA` instead of the hardcoded lists, so they cover the whole CollisionObject2D family. Three new rules, at most one
  issue per node: `unknown-class`, `not-a-node`, `not-instantiable` (all errors).
- `tools/scene-node.ts`: `SceneNode.type` is now `NodeType`, so bad class names are ordinary TypeScript errors.
- `sample/class-typo.example.ts` + `tsconfig.examples.json` (`npm run check:examples`): the deliberate mistakes, kept out
  of `npm run check` by an `exclude` in `tsconfig.json`. `src` was added to `tsconfig.json`'s `include`.
- New fixtures: `unknown-class.ts`, `not-a-node.ts`, `not-instantiable.ts` (cast with `as unknown as SceneNode`, because
  TypeScript now rejects those types, which is the point). The existing `animatable-with-shape.ts` and
  `animatable-no-shape.ts` are now used by tests.
- `sprite-needs-texture` is untouched (the user has not decided on it).

### Commands and output

```
$ npm run gen-classes          (run twice; TMPDIR pointed at the scratch folder)
wrote .../data/classes.json (83295 bytes)
wrote .../src/node-types.gen.ts (5535 bytes)
Godot Engine v4.7.2.stable.official: 1036 classes, 253 instantiable node types
... second run:
unchanged .../data/classes.json
unchanged .../src/node-types.gen.ts
```

```
$ node tools/validate-scene.ts sample/fixtures/animatable-with-shape.ts
ok: no issues                                          (exit 0; was a false warning before)
$ node tools/validate-scene.ts sample/fixtures/animatable-no-shape.ts
warning: Platform: This node has no shape, so it can't collide or interact with other objects. Consider adding a CollisionShape2D or CollisionPolygon2D as a child to define its shape.
0 error(s), 1 warning(s)                               (exit 0; was "ok: no issues" before)
$ node tools/validate-scene.ts sample/fixtures/unknown-class.ts
error: Oops: "Node2Dd" is not a Godot class. Did you mean "Node2D"?
1 error(s), 0 warning(s)                               (exit 1)
$ node tools/validate-scene.ts sample/fixtures/not-a-node.ts
error: Circle: "CircleShape2D" is a Resource, not a Node, so it cannot be a node in the scene tree. Resources like this are set as a property of a node instead (for example a shape is the "shape" prop of a CollisionShape2D).
1 error(s), 0 warning(s)                               (exit 1)
$ node tools/validate-scene.ts sample/fixtures/not-instantiable.ts
error: Item: "CanvasItem" is abstract: Godot cannot create one directly. Use a concrete type that extends it, such as Control, Node2D.
1 error(s), 0 warning(s)                               (exit 1)
```

The TypeScript side (what the editor shows), `npm run check:examples`:

```
sample/class-typo.example.ts(5,45): error TS2820: Type '"Node2Dd"' is not assignable to type 'NodeType'. Did you mean '"Node2D"'?
sample/class-typo.example.ts(6,49): error TS2322: Type '"CircleShape2D"' is not assignable to type 'NodeType'.
sample/class-typo.example.ts(7,54): error TS2322: Type '"CanvasItem"' is not assignable to type 'NodeType'.
(exit 2)
```
The messages are short and readable: TypeScript does not print the 253-member union, and for a near miss it adds its own
"Did you mean". The plain `TS2322` lines for `CircleShape2D` and `CanvasItem` do not say why; the validator's messages do.

Before / after: `npm test` 23 tests -> 40 tests, all passing; `npx tsc --noEmit` clean both times.

### Tests changed or added

Changed (none of the old tests encoded the wrong behaviour: no old test touched AnimatableBody2D):
- `body-needs-shape: a CollisionPolygon2D child is enough ...`: the type list got `as const` (needed now that `type` is a
  union), and was extended from 4 to 6 types (added AnimatableBody2D and PhysicalBone2D). Title changed to match.
- The per-rule table gained three rows (`unknown-class`, `not-a-node`, `not-instantiable`), so the existing test
  "every rule in RULES has a fixture above" (now 9 rules, 9 rows) still holds.

Added (17): AnimatableBody2D with a shape (no issue) and without (one warning); `isA` (including `"constructor"`);
the exact typo message; `didYouMean` cases (case, far-off name, a near miss that is a Resource); "check the spelling"
for a far-off name; JavaScript built-in names (`constructor`, `toString`, `__proto__`) are unknown classes; the
not-a-node and not-instantiable messages; no double reporting; and a property test that every class in the generated
`NodeType` union passes the three class rules (so the generated union and the validator agree).

### Unverified / caveats

- Only checked by CLI and tests. The class typo squiggle was not looked at in Cursor (only `tsc` output above).
  The Godot editor was not reopened for this follow-up.
- Only AnimatableBody2D was ever observed in the editor. `PhysicalBone2D` and the other members of the family follow
  the same rule in Godot's source, but were not opened in the editor.
- The data is from Godot 4.7.2 only; other versions are not checked (regenerate with `npm run gen-classes`).
- Classes that are not in Godot's own API (GDExtension or addon classes) are reported as `unknown-class`. A scene
  node's `type` in a `.tscn` is always a native class (scripts go through the `script` property), so this should not
  matter for normal scenes, but it was not tested with an addon.
- `didYouMean` is plain edit distance (2 edits at most), so some sensible suggestions will be missed.
- The 253-member union's effect on editor speed was not measured.
- PoC 4 still uses its own guessed `SceneNode` stub (`type: string`), so the editor plugin does not see this new type yet.
