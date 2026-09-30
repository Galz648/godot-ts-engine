import type { SceneNode } from "../../tools/scene-node.ts";

// A slash in a name: one valid-name error.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "a/b", type: "Node2D" }],
};

export default tree;
