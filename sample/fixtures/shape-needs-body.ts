import type { SceneNode } from "../../tools/scene-node.ts";

// A CollisionShape2D under a plain Node2D: one shape-needs-body warning.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "Shape", type: "CollisionShape2D", props: { shape: "rect" } }],
};

export default tree;
