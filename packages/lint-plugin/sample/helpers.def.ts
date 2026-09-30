// Written the way real definitions are: helper functions, a loop, a spread, a registry-style script constant.
// The plugin reads only the literal parts of `scene`; everything built by a call, a variable or a spread is opaque.
import type { SceneNode } from "../../scene/src/index.ts";
import type { NodeType } from "../../validator/src/node-types.gen.ts";

type GameNode = SceneNode<{ type: NodeType; script: string; texture: string }>;
const Scripts = { paddle: "res://scripts/paddle.gd" } as const;

const shape = (): GameNode => ({ name: "Shape", type: "CollisionShape2D", props: { shape: { sub: { type: "CircleShape2D" } } } });
const paddle = (name: string): GameNode => ({ name, type: "CharacterBody2D", script: Scripts.paddle, children: [shape()] });
const bricks: GameNode[] = [1, 2, 3].map((i) => paddle(`Brick_${i}`));
const base = { offset_left: 1 };

export const scene: GameNode = {
  name: "Main",
  type: "Node2D",
  script: Scripts.paddle,
  children: [
    paddle("Player"),
    { name: "Bricks", type: "Node2D", children: bricks },
    { name: "Body", type: "StaticBody2D", children: [shape(), { name: "Sprite", type: "Sprite2D", props: { texture: { ext: "res://art/x.png" } } }] },
    { name: "Label", type: "Label", props: { ...base, text: "hi" } },
    { name: "Body2", type: "StaticBody2D", children: [{ name: "Shape2", type: "CollisionShape2D", props: { ...base } }] },
  ],
};
