import type { SceneNode } from "../../tools/scene-node.ts";

// CircleShape2D is a Resource, not a Node: it cannot sit in the scene tree. One not-a-node issue.
// (Cast, because TypeScript already rejects it: see sample/class-typo.example.ts.)
const tree = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "Circle", type: "CircleShape2D" }],
} as unknown as SceneNode;

export default tree;
