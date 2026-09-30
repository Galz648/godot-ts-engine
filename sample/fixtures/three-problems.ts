import type { SceneNode } from "../../tools/scene-node.ts";

// Three unrelated problems in one tree: the validator must report all three in one run.
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [
    { name: "Ball", type: "CharacterBody2D" }, //          1. body-needs-shape (warning)
    { name: "Dup", type: "Node2D" },
    { name: "Dup", type: "Node2D" }, //                     2. unique-sibling-names (error)
    { name: "bad:name", type: "Node2D" }, //                3. valid-name (error)
  ],
};

export default tree;
