import { expect, test } from "bun:test";
import { emitTscn } from "../../emitter/tools/emit-tscn.ts";
import type { SceneNode } from "../../scene/src/index.ts";
import { merge3 } from "./merge.ts";
import { parseTscn } from "./parse.ts";

const level: SceneNode = {
  name: "Level",
  type: "Node2D",
  script: "res://scripts/level.gd",
  scriptProps: { lives: 3 },
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: "res://scripts/ball.gd",
      props: { position: { raw: "Vector2(64, 64)" }, visible: true },
      scriptProps: { speed: 420 },
      children: [
        { name: "Sprite", type: "Sprite2D", props: { texture: { ext: "res://art/ball.png" } } },
        { name: "Shape", type: "CollisionShape2D", props: { shape: { sub: { type: "CircleShape2D", props: { radius: 8 } } } } },
      ],
    },
    { name: "Hud", type: "Label", props: { text: 'Score "0"', offset_left: 24 } },
  ],
};

// ---- reading a scene back ---------------------------------------------------------------------

test("round trip: emit, parse, emit gives the same text", () => {
  const text = emitTscn(level);
  const { root, unsupported } = parseTscn(text);
  expect(unsupported).toEqual([]);
  expect(emitTscn(root)).toBe(text);
});

test("reads Godot's own formatting: no load_steps, random ids, 40.0 numbers, script between props and script variables", () => {
  const godot = `[gd_scene format=3 uid="uid://b8x2k3j9q1w4r"]

[ext_resource type="Script" path="res://scripts/ball.gd" id="1_yb28l"]
[ext_resource type="Texture2D" path="res://art/ball.png" id="2_lp7cx"]

[sub_resource type="CircleShape2D" id="CircleShape2D_4f8ka"]
radius = 8.0

[node name="Level" type="Node2D" unique_id=492501466]

[node name="Ball" type="CharacterBody2D" parent="." unique_id=387638424]
position = Vector2(64, 64)
script = ExtResource("1_yb28l")
speed = 420.0

[node name="Sprite" type="Sprite2D" parent="Ball" unique_id=1748518502]
texture = ExtResource("2_lp7cx")

[node name="Shape" type="CollisionShape2D" parent="Ball" unique_id=91827364]
shape = SubResource("CircleShape2D_4f8ka")
`;
  const { root, unsupported } = parseTscn(godot);
  expect(unsupported).toEqual([]);
  const ball = root.children![0];
  expect(ball.script).toBe("res://scripts/ball.gd");
  expect(ball.props).toEqual({ position: { raw: "Vector2(64, 64)" } });
  expect(ball.scriptProps).toEqual({ speed: 420 });
  expect(ball.children![0].props).toEqual({ texture: { ext: "res://art/ball.png" } });
  expect(ball.children![1].props).toEqual({ shape: { sub: { type: "CircleShape2D", props: { radius: 8 } } } });
});

test("what the model cannot hold is reported, not silently dropped: groups, connections, instances, other resources", () => {
  const rich = `[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/main.gd" id="1_a"]
[ext_resource type="PackedScene" path="res://scenes/enemy.tscn" id="2_b"]
[ext_resource type="AudioStream" path="res://audio/hit.ogg" id="3_c"]

[node name="Main" type="Node2D"]
script = ExtResource("1_a")

[node name="Enemy" parent="." instance=ExtResource("2_b")]

[node name="Btn" type="Button" parent="." groups=["ui"]]
stream = ExtResource("3_c")

[connection signal="pressed" from="Btn" to="." method="_on_pressed"]
`;
  const { unsupported } = parseTscn(rich);
  const all = unsupported.join(" | ");
  expect(all).toContain("instance");
  expect(all).toContain("groups");
  expect(all).toContain("connection");
  expect(all).toContain("AudioStream");
});

// ---- three-way merge -----------------------------------------------------------------------------

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const find = (n: SceneNode, name: string) => n.children!.find((c) => c.name === name)!;

test("a change on one side only is kept, from either side", () => {
  const base = level, ours = clone(level), theirs = clone(level);
  find(ours, "Hud").props!.text = "Score 1"; //                          TypeScript changed the label
  (find(theirs, "Ball").props!.position as { raw: string }).raw = "Vector2(99, 64)"; // Godot moved the ball
  const { merged, conflicts } = merge3(base, ours, theirs);
  expect(conflicts).toEqual([]);
  expect(find(merged, "Hud").props!.text).toBe("Score 1");
  expect(find(merged, "Ball").props!.position).toEqual({ raw: "Vector2(99, 64)" });
});

test("both sides changed the same property differently: a conflict, TypeScript wins, and it says where", () => {
  const ours = clone(level), theirs = clone(level);
  find(ours, "Hud").props!.offset_left = 10;
  find(theirs, "Hud").props!.offset_left = 50;
  const { merged, conflicts } = merge3(level, ours, theirs);
  expect(find(merged, "Hud").props!.offset_left).toBe(10);
  expect(conflicts.length).toBe(1);
  expect(conflicts[0].path).toBe("Hud");
});

test("a node added in Godot survives; a node added in TypeScript appears", () => {
  const ours = clone(level), theirs = clone(level);
  theirs.children!.push({ name: "Timer", type: "Timer", props: { wait_time: 3 } });
  ours.children!.push({ name: "Camera", type: "Camera2D" });
  const { merged, conflicts } = merge3(level, ours, theirs);
  expect(conflicts).toEqual([]);
  expect(merged.children!.map((c) => c.name)).toEqual(["Ball", "Hud", "Camera", "Timer"]);
});

test("TypeScript deletes a node Godot left alone: deleted. Godot had edited it: a conflict, the node stays", () => {
  const ours = clone(level);
  ours.children = ours.children!.filter((c) => c.name !== "Hud");
  expect(merge3(level, ours, clone(level)).merged.children!.map((c) => c.name)).toEqual(["Ball"]);

  const edited = clone(level);
  find(edited, "Hud").props!.text = "edited in Godot";
  const r = merge3(level, ours, edited);
  expect(r.conflicts.length).toBe(1);
  expect(r.merged.children!.map((c) => c.name)).toEqual(["Ball", "Hud"]);
});

test("a rename cannot be told from delete plus add: both names exist afterwards", () => {
  const theirs = clone(level);
  find(theirs, "Hud").name = "Score"; // renamed in Godot
  const ours = clone(level);
  find(ours, "Hud").props!.text = "Score 1"; // changed in TypeScript
  const { merged, conflicts } = merge3(level, ours, theirs);
  expect(merged.children!.map((c) => c.name).sort()).toEqual(["Ball", "Hud", "Score"]);
  expect(conflicts.length).toBe(1); // the old Hud was edited by TypeScript and deleted by Godot
});

test("end to end: Godot-saved file (new ids, an added node, a moved ball) plus a TypeScript edit, merged and written out", () => {
  const baseText = emitTscn(level);
  // what the editor would save: same scene, ids re-randomised, one property moved, one node added
  const godotText = baseText
    .replace(/"1_level"/g, '"1_xq7vd"').replace(/"2_ball"/g, '"2_k3j9m"')
    .replace("Vector2(64, 64)", "Vector2(99, 64)")
    + '\n[node name="Timer" type="Timer" parent="."]\nwait_time = 3.0\n';
  const ours = clone(level);
  find(ours, "Hud").props!.text = "Score 1";
  const { merged, conflicts } = merge3(parseTscn(baseText).root, ours, parseTscn(godotText).root);
  expect(conflicts).toEqual([]);
  const out = emitTscn(merged);
  expect(out).toContain("Vector2(99, 64)"); //  Godot's move kept
  expect(out).toContain('"Score 1"'); //        TypeScript's edit kept
  expect(out).toContain('name="Timer"'); //     Godot's new node kept
});
