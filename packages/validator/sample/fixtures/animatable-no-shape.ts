import type { SceneNode } from "../../tools/scene-node.ts";

// An AnimatableBody2D with no shape. Godot warns (see godot-check/animatable-no-shape.tscn).
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "Platform", type: "AnimatableBody2D" }],
};

export default tree;
