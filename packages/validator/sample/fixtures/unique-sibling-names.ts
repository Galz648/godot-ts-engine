import type { SceneNode } from "../../tools/scene-node.ts";

// Two children called "Dup": one unique-sibling-names error, on the second one.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [
    { name: "Dup", type: "Node2D" },
    { name: "Dup", type: "Node2D" },
  ],
};

export default tree;
