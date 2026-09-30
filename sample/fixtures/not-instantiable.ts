import type { SceneNode } from "../../tools/scene-node.ts";

// CanvasItem is an abstract Node class: Godot cannot create one. One not-instantiable issue.
// (Cast, because TypeScript already rejects it: see sample/class-typo.example.ts.)
const tree = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "Item", type: "CanvasItem" }],
} as unknown as SceneNode;

export default tree;
