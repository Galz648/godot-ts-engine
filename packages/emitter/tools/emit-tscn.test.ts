// Run: bun test tools/emit-tscn.test.ts   (dev-only: the emitter itself uses Node built-ins only)
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { emitTscn } from "./emit-tscn.ts";
import type { SceneNode } from "../../scene/src/index.ts";

test("handover example is unchanged (byte for byte)", () => {
  const tree: SceneNode = {
    name: "Main",
    type: "Node2D",
    children: [
      {
        name: "Ball",
        type: "CharacterBody2D",
        script: "res://scripts/ball.gd",
        props: { position: { raw: "Vector2(320, 180)" } },
        children: [{ name: "Sprite", type: "Sprite2D", props: { texture: { ext: "res://art/ball.png" } } }],
      },
    ],
  };
  const expected = readFileSync(new URL("../experiments/expected-main.tscn", import.meta.url), "utf8");
  expect(emitTscn(tree)).toBe(expected);
});

test("scriptProps are written AFTER the script line (Godot silently drops them before it)", () => {
  const out = emitTscn({
    name: "Root",
    type: "Node2D",
    children: [
      { name: "Enemy", type: "ColorRect", script: "res://scripts/paddle.gd", props: { offset_left: 10 }, scriptProps: { is_player: false, speed: 300 } },
    ],
  });
  const block = out.split("\n\n").find((b) => b.includes('name="Enemy"'))!.trimEnd().split("\n");
  expect(block).toEqual([
    '[node name="Enemy" type="ColorRect" parent="."]',
    "offset_left = 10", //              engine properties first
    'script = ExtResource("1_paddle")', // then the script
    "is_player = false", //              then the script's own variables
    "speed = 300",
  ]);
});

test("scriptProps can hold resources, and they get ids in order of use", () => {
  const out = emitTscn({
    name: "Root",
    type: "Node2D",
    script: "res://scripts/a.gd",
    scriptProps: { icon: { ext: "res://art/i.png" } },
  });
  expect(out).toContain('[ext_resource type="Script" path="res://scripts/a.gd" id="1_a"]');
  expect(out).toContain('[ext_resource type="Texture2D" path="res://art/i.png" id="2_i"]');
  expect(out).toContain('script = ExtResource("1_a")\nicon = ExtResource("2_i")');
});
