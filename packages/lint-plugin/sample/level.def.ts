import type { SceneNode } from "../../scene/src/index.ts";
import type { NodeType } from "../../validator/src/node-types.gen.ts";

type Vocab = { type: NodeType; script: "res://scripts/ball.gd"; texture: "res://art/ball.png" };

export const scene = {
  name: "Level",
  type: "Node2D",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: "res://scripts/ball.gd",
      children: [
        { name: "Shape", type: "CollisionShape2D", props: { shape: { sub: { type: "CircleShape2D", props: { radius: 8 } } } } },
        { name: "Sprite", type: "Sprite2D", props: { texture: { ext: "res://art/ball.png" } } },
      ],
    },
    { name: "Walls", type: "Node2D" },
  ],
} satisfies SceneNode<Vocab>;
