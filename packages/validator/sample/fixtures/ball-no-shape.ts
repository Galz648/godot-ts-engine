import type { SceneNode } from "../../tools/scene-node.ts";

// "clean" with the Ball's CollisionShape2D removed: one body-needs-shape warning naming Ball.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      children: [{ name: "Sprite", type: "Sprite2D", props: { texture: "res://art/ball.png" } }],
    },
  ],
};

export default tree;
