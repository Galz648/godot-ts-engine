import type { SceneNode } from "../tools/emit-tscn.ts";

const scene: SceneNode = {
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

export default scene;
