import type { SceneNode } from "../plugins/scene-lint/stub/types";

export const scene = {
  name: "Level",
  type: "Node2D",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: "res://scripts/ball.gd",
      children: [
        { name: "Shape", type: "CollisionShape2D" },
        { name: "Sprite", type: "Sprite2D", texture: "res://art/ball.png" },
      ],
    },
    { name: "Walls", type: "Node2D" },
  ],
} satisfies SceneNode;
