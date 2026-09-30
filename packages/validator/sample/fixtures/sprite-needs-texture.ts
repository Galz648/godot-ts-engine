import type { SceneNode } from "../../tools/scene-node.ts";

// A Sprite2D without a texture prop: one sprite-needs-texture warning.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "Sprite", type: "Sprite2D" }],
};

export default tree;
