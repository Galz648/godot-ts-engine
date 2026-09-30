// Each line must be a type error. These are the typos the registry and the class list exist to catch.
import type { ScriptPath, TexturePath } from "../../registry/src/registry.gen.ts";
import type { NodeType } from "../../validator/src/node-types.gen.ts";
import type { SceneNode } from "../src/index.ts";

type GameNode = SceneNode<{ type: NodeType; script: ScriptPath; texture: TexturePath }>;

export const bad: GameNode[] = [
  { name: "A", type: "CharacterBody2D", script: "res://scripts/bal.gd" }, //                   1. script typo
  { name: "B", type: "Sprite2D", props: { texture: { ext: "res://art/bal.png" } } }, //        2. texture typo
  { name: "C", type: "Node2Dd" }, //                                                            3. class typo
];
