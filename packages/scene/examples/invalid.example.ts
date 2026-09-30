// Each line must be a type error. `bun run check:examples` counts them and fails if the count changes.
import type { SceneNode } from "../src/index.ts";

type Game = { type: "Node2D" | "Sprite2D"; script: "res://scripts/ball.gd"; texture: "res://art/ball.png" };

export const bad: SceneNode<Game>[] = [
  { name: "A", type: "Node2Dd" }, //                                     1. class not in the vocabulary
  { name: "B", type: "Node2D", script: "res://scripts/nope.gd" }, //      2. script not in the vocabulary
  { name: "C", type: "Sprite2D", props: { texture: { ext: "res://art/bal.png" } } }, // 3. texture typo
  { name: 5, type: "Node2D" }, //                                          4. name must be a string
  { name: "D", type: "Node2D", colour: "red" }, //                         5. unknown field
  { name: "E", type: "Node2D", props: { p: [1, 2] } }, //                  6. arrays are not a PropValue (use { raw })
  { name: "F", type: "Node2D", children: [{ name: "G" }] }, //             7. type is required, on a nested child too
];

// A narrow tree must NOT accept a wide one: this is the direction that has to stay unsafe.
declare const wide: SceneNode;
export const notAllowed: SceneNode<Game> = wide; //                      8. wide is not assignable to narrow
