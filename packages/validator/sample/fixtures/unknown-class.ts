import type { SceneNode } from "../../tools/scene-node.ts";

// A typo'd class name. TypeScript already rejects "Node2Dd" in the editor (see sample/class-typo.example.ts), so this
// fixture casts the tree to reach the validator's own unknown-class rule: one issue, with a "did you mean" hint.
const tree = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "Oops", type: "Node2Dd" }],
} as unknown as SceneNode;

export default tree;
