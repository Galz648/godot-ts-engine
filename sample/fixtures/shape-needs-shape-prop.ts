import type { SceneNode } from "../../tools/scene-node.ts";

// A CollisionShape2D without a shape prop: one shape-needs-shape-prop warning.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [
    {
      name: "Wall",
      type: "StaticBody2D",
      children: [{ name: "Shape", type: "CollisionShape2D" }],
    },
  ],
};

export default tree;
