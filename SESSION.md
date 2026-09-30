# PoC 2 session: declarative tree to .tscn emitter

Date: 2026-09-30. Spec: `pocs/Handover declarative tree to .tscn emitter (PoC 2).md`.
Godot used for all checks: `4.7.2.stable.official.ed1daf0bf`. `tsc` 5.9.x.

## Intent

Prove that a plain TypeScript data tree can be written out as a valid, fully wired Godot 4 `main.tscn`
(scripts and textures attached), as a one-shot scaffolding step. The emitter trusts its input (validation is PoC 3)
and never writes script bodies.

## Tasks

1. Bun project `pocs/poc2-emitter/` (TypeScript `~5.9`, `@types/node` for typechecking only).
2. `src/paths.ts`: hand-written stand-in for PoC 1's `ScriptPath` / `TexturePath` (standalone, no import from PoC 1).
3. `tools/emit-tscn.ts` (110 lines, `node:fs`/`node:path`/`node:url` only): `emitTscn(root)` plus a CLI.
4. `sample/`: a minimal Godot project (`ball.gd`, `ball.png`), `scene.def.ts`, generated `main.tscn`.
5. Run every acceptance check; `experiments/` holds the extra tree definitions and Godot scripts used by them.

## Completed

All 7 checks passed. Checks 4 and 5 were run by hand by the user in the Godot editor (I have no GUI access);
checks 1, 2, 3, 6 and 7 were run here. The stretch goal (`sub_resource`) is done and loads cleanly in Godot.

## Acceptance checks (actual commands and output)

Run from `pocs/poc2-emitter/`.

**1. Sample tree matches the handover example** - `bun run emit` (= `bun tools/emit-tscn.ts sample/scene.def.ts sample/main.tscn`),
then `diff experiments/expected-main.tscn sample/main.tscn` (expected file copied verbatim from the handover):

```
wrote …/pocs/poc2-emitter/sample/main.tscn
IDENTICAL to handover example      (diff produced no output, exit 0)
```
PASS.

**2. Byte-identical on a second run** - hash and mtime compared around a second run (1.2 s apart):

```
unchanged …/pocs/poc2-emitter/sample/main.tscn
hash same: yes  mtime same: yes
```
PASS. (The CLI does not rewrite an unchanged file.)

**3. `godot --headless --path sample --quit` loads with no errors** - PASS, but only after an import pass. First attempt:

```
ERROR: No loader found for resource: res://art/ball.png (expected type: Texture2D)
ERROR: res://main.tscn:13 - Parse Error: [ext_resource] referenced non-existent resource at: res://art/ball.png.
exit 0
```
This is not an emitter problem: a fresh Godot project has to be imported once (`godot --headless --path sample --import`,
which creates `.godot/imported/` and `art/ball.png.import`). After that:

```
Godot Engine v4.7.2.stable.official.ed1daf0bf - https://godotengine.org

exit 0
```
Note: Godot exits 0 even when it prints load errors, so this check has to read the output, not the exit code.
"No errors" alone does not prove the scene loaded, so I added `experiments/inspect.gd` (see check 4 stand-in).

**4. Editor shows the expected tree, scripts and textures attached** - PASS (run by hand by the user in the Godot
4.7.2 editor on `sample/`). The user reported that everything worked: tree Main > Ball > Sprite, script on Ball,
texture on Sprite, Ball position (320, 180). Whether the editor showed a configuration-warning triangle on Ball
(a `CharacterBody2D` with no shape) was not reported. Opening the project made the editor add only a comment header
to `sample/project.godot`.
Before that, headless stand-in (loads and instantiates the scene through Godot's loader):
`godot --headless --path sample -s ../experiments/inspect.gd`

```
TREE Main : Node2D  position=(0.0, 0.0)
TREE   Ball : CharacterBody2D  script=res://scripts/ball.gd  position=(320.0, 180.0)
TREE     Sprite : Sprite2D  texture=res://art/ball.png  position=(0.0, 0.0)
```

**5. Saving from the editor changes little** - PASS (run by hand by the user in the Godot 4.7.2 editor). Result first:
the user moved Ball's X position in the editor and pressed Ctrl+S; `git diff sample/main.tscn` showed exactly one line:

```
-position = Vector2(320, 180)
+position = Vector2(420, 180)
```
That is the user's own edit. The editor kept `[gd_scene load_steps=3 format=3]`, kept the ids `1_ball` / `2_ball`, and added no
`uid`, no `unique_id` and no reordering. So an editor save of an emitter-written scene changes only what you edited.
Caveat: this is one save of one small scene, and the save included a real edit (so the file was definitely re-serialized).

The headless stand-in I ran first turned out to be misleading. `godot --headless --path sample -s ../experiments/resave.gd` saves the scene with
`ResourceSaver` (Godot's own serializer, the same one the editor uses on save) to a copy, then `diff` against `main.tscn`:

```
1c1
< [gd_scene load_steps=3 format=3]
---
> [gd_scene format=3]
3,4c3,4
< [ext_resource type="Script" path="res://scripts/ball.gd" id="1_ball"]
< [ext_resource type="Texture2D" path="res://art/ball.png" id="2_ball"]
---
> [ext_resource type="Script" path="res://scripts/ball.gd" id="1_yb28l"]
> [ext_resource type="Texture2D" path="res://art/ball.png" id="2_lp7cx"]
10c10
< script = ExtResource("1_ball")
---
> script = ExtResource("1_yb28l")
13c13
< texture = ExtResource("2_ball")
---
> texture = ExtResource("2_lp7cx")
```
What changed there: `load_steps` dropped and the ids replaced by random ones (`1_ball` -> `1_yb28l`). The real editor save
did NOT do either, so `ResourceSaver.save` called from a headless script is not a faithful stand-in for the editor's save.

**6. Three-level tree gets correct `parent` paths** - `experiments/three-level.def.ts` (Main > A > B > C > E, plus D under B):

```
[node name="Main" type="Node2D"]
[node name="A" type="Node2D" parent="."]
[node name="B" type="Node2D" parent="A"]
[node name="C" type="Node2D" parent="A/B"]
[node name="E" type="Node2D" parent="A/B/C"]
[node name="D" type="Node2D" parent="A/B"]
```
Godot loaded it with the right nesting (inspect.gd): `Main / A / B / C / E` and `B / D`. PASS.

**7. A script path that was never compiled is a load error, not a silent success** - `experiments/ghost.def.ts`
points a node at `res://scripts/ghost.gd` (valid in the stub `ScriptPath`, no such file):

```
ERROR: Attempt to open script 'res://scripts/ghost.gd' resulted in error 'File not found'.
ERROR: Failed loading resource: res://scripts/ghost.gd.
ERROR: res://_ghost.tscn:8 - Parse Error: [ext_resource] referenced non-existent resource at: res://scripts/ghost.gd.
TREE Main : Node2D  position=(0.0, 0.0)
TREE   Ghost : Node2D  position=(0.0, 0.0)
```
PASS with a caveat: the error is loud, but the scene still loads. The `Ghost` node exists and simply has no script, and
the process exit code is still 0. Anything that only looks at the exit code would miss it.

## Stretch goal: inline `sub_resource`

`{ sub: { type, props } }` as a prop value emits a `[sub_resource ...]` block (before the nodes) and `SubResource("RectangleShape2D_1")`.
`experiments/collision.def.ts` gives a `CollisionShape2D` with a `RectangleShape2D`:

```
[gd_scene load_steps=4 format=3]
...
[sub_resource type="RectangleShape2D" id="RectangleShape2D_1"]
size = Vector2(16, 16)
...
[node name="Shape" type="CollisionShape2D" parent="Ball"]
shape = SubResource("RectangleShape2D_1")
```
Loads with no errors in Godot 4.7.2; the tree shows `Ball / Shape / Sprite`. Nested sub-resources (a sub inside a sub) are
handled by construction (inner ones are registered first) but I did not test that.

## Findings and surprises

- **Fresh projects need an import pass** before any texture loads (check 3). `--import` does it. Once the real
  flow runs against the game project, the editor has normally done this already.
- **Godot exits 0 on load errors** and still instantiates partially loaded scenes (check 7).
- **An editor save preserved the emitter's ids and header** (check 5). A headless `ResourceSaver.save` rewrote both
  (`1_ball` -> `1_yb28l`, `load_steps` dropped), so that is not how the editor behaves. Re-emitting over an
  editor-saved scene therefore produced a clean one-line diff here, not an all-ids diff. Not tested: a scene where the user
  adds new nodes or resources in the editor (Godot will assign its own ids to those).
- **`@types/node`** is needed for `tsc` to typecheck a file that imports `node:fs`. It is a dev dependency only;
  the emitter itself is built-ins only. (PoC 1's script is outside its tsconfig `include`, so this did not come up there.)

## Decisions to review

1. **Ids** are `<n>_<file stem>` (from the handover example), `n` = order of first use. "First use" is the order the lines
   appear in the node blocks: a node's props in the order written, then its `script`. Stems are sanitised to `[A-Za-z0-9_]`.
2. **Header without resources** is `[gd_scene format=3]` (no `load_steps=1`), which is what Godot itself writes.
3. **Def file contract:** `export default` a `SceneNode` (a named `scene` export also works).
4. **`{ ext: ... }` is textures only**, as in the handover type (`Texture2D`); scripts go through `script`.
5. **Strings** use `JSON.stringify` (quotes, backslashes, newlines are escaped the way Godot reads them). Non-finite numbers throw.
6. **Sub-resource ids** are `<Type>_<n>`; Godot itself uses random suffixes.
7. The CLI only writes when the text changed (same idea as PoC 1), so watchers are not retriggered.
8. `sample/art/ball.png.import` was generated by Godot's import and is committed, as normal for a Godot project.
   `sample/.godot/` is git-ignored.

## Not done / limits

- Windows: not run. CLI paths go through `path.resolve`; output is always LF; `res://` strings are plain strings, never file paths.
- Custom node properties beyond numbers, booleans, strings, raw literals, textures and inline sub-resources
  (for example arrays, dictionaries, `NodePath`s) are only possible through `{ raw: "..." }`.
- Instanced sub-scenes and `uid://` references are out of scope, as specified.

## Next steps

PoC 3 would validate the same `SceneNode` tree before it is emitted. Not integrated here, as instructed.
