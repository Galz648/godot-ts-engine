import type { SceneNode } from "../../tools/scene-node.ts";

// Script variables on a node that has no script: one script-props-need-script warning.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "Enemy", type: "ColorRect", scriptProps: { is_player: false } }],
};

export default tree;
