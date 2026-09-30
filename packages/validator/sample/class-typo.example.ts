// Deliberate mistakes for the editor: each line is an ordinary TypeScript error because SceneNode.type is the
// generated NodeType union. Excluded from `npm run check` (tsconfig.json); checked by `npm run check:examples`.
import type { SceneNode } from "../tools/scene-node.ts";

export const typo: SceneNode = { name: "A", type: "Node2Dd" }; //          a misspelled class
export const notANode: SceneNode = { name: "B", type: "CircleShape2D" }; // a Resource, not a Node
export const abstractClass: SceneNode = { name: "C", type: "CanvasItem" }; // abstract: cannot be created
