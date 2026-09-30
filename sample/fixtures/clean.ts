import type { SceneNode } from "../../tools/scene-node.ts";

// A healthy tree: every rule is satisfied.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: "res://scripts/ball.gd",
      children: [
        { name: "Sprite", type: "Sprite2D", props: { texture: "res://art/ball.png" } },
        { name: "Shape", type: "CollisionShape2D", props: { shape: "circle" } },
      ],
    },
    {
      name: "Walls",
      type: "StaticBody2D",
      children: [{ name: "Shape", type: "CollisionShape2D", props: { shape: "rect" } }],
    },
  ],
};

export default tree;
