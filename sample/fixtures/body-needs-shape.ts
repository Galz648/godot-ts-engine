import type { SceneNode } from "../../tools/scene-node.ts";

// A body with no shape child: one body-needs-shape warning.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "Ball", type: "CharacterBody2D" }],
};

export default tree;
