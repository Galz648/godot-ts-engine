import type { SceneNode } from "../tools/emit-tscn.ts";

// Stretch goal: an inline sub_resource (RectangleShape2D) on a CollisionShape2D.
const scene: SceneNode = {
  name: "Main",
  type: "Node2D",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: "res://scripts/ball.gd",
      children: [
        {
          name: "Shape",
          type: "CollisionShape2D",
          props: { shape: { sub: { type: "RectangleShape2D", props: { size: { raw: "Vector2(16, 16)" } } } } },
        },
        { name: "Sprite", type: "Sprite2D", props: { texture: { ext: "res://art/ball.png" } } },
      ],
    },
  ],
};

export default scene;
