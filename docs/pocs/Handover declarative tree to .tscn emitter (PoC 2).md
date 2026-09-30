# Handover: declarative tree to .tscn emitter (PoC 2)

Sep 30, 2026 · @HUMONGOUSCOCKOUS

## Context and goal

Write a script that takes a scene tree described as plain TypeScript data and writes a valid Godot 4 main.tscn, with each node wired to its script and textures. The tree is known before the game runs, and nodes are never added at runtime.

This is the second of four separate proofs of concept. It is a one-shot scaffolding step: run it when the structure changes, then work in Godot and the tstogd-compiled scripts as usual. Scripts are referenced, never generated or overwritten.

PoC 1 produces the `ScriptPath` and `TexturePath` types. This PoC should use them if available, but must also run standalone with a hand-written stub of those two types.

## Scope and constraints

In scope:

- A `SceneNode` data type and a function `emitTscn(root: SceneNode): string`.
- `ext_resource` entries for scripts and textures, deduplicated, with stable ids.
- `node` blocks with correct `parent` paths, and properties: numbers, booleans, quoted strings, raw Godot literals such as `Vector2(10, 20)`, and resource references.
- A CLI that imports a tree definition file and writes the result to a given path.

Out of scope:

- Checking whether the tree makes sense (duplicate names, missing collision shapes). That is PoC 3; this emitter trusts its input.
- Generating script bodies, parsing existing .tscn files, or merging with hand edits.
- Instanced sub-scenes and `uid://` references.

Stretch goal: inline `sub_resource` entries, e.g. a `RectangleShape2D` for a `CollisionShape2D`.

Constraints: Node built-ins only, one file under roughly 200 lines, deterministic output (same input, byte-identical file), Windows-safe paths, time-boxed to about two hours. Write a SESSION.md with intent, tasks, completed work, findings and next steps.

## Deliverables and output shape

Deliver `tools/emit-tscn.ts`, a `sample/scene.def.ts` tree definition, the generated `sample/main.tscn`, and SESSION.md.

The input type, kept deliberately plain:

```ts
type PropValue =
  | number
  | boolean
  | string                    // emitted quoted: "Hello"
  | { raw: string }           // emitted as-is: Vector2(10, 20)
  | { ext: TexturePath };     // emitted as ExtResource("2_ball")

type SceneNode = {
  name: string;
  type: string;               // Godot class, e.g. "CharacterBody2D"
  script?: ScriptPath;
  props?: Record<string, PropValue>;
  children?: SceneNode[];
};
```

For a Main node with a Ball body holding a sprite, the expected output is:

```
[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/ball.gd" id="1_ball"]
[ext_resource type="Texture2D" path="res://art/ball.png" id="2_ball"]

[node name="Main" type="Node2D"]

[node name="Ball" type="CharacterBody2D" parent="."]
position = Vector2(320, 180)
script = ExtResource("1_ball")

[node name="Sprite" type="Sprite2D" parent="Ball"]
texture = ExtResource("2_ball")
```

Format rules to get right:

- `load_steps` = number of resources + 1.
- The root node has no `parent`; its children use `parent="."`; deeper nodes use the path from the root, e.g. `parent="Ball/Sprite"`.
- Nodes appear depth-first, parents before children.
- Resource ids are assigned in order of first use, so output stays stable.

## Acceptance criteria

Done means each check runs by hand and behaves as described, with actual output recorded in SESSION.md.

- [ ] Emitting the sample tree produces a file matching the example above.
- [ ] Running twice gives a byte-identical file.
- [ ] `godot --headless --path sample --quit` loads with no errors in the output.
- [ ] Opening main.tscn in the Godot editor shows the expected tree, with scripts and textures attached.
- [ ] Saving the scene from the editor produces only a small diff (uids and similar metadata), no structural changes. Record what changed.
- [ ] A three-level tree gets correct `parent` paths at every level.
- [ ] A script path that exists in the registry but whose file was never compiled shows up as a Godot load error, not a silent success. Note the exact message.
