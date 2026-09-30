import type { SceneNode } from "../tools/emit-tscn.ts";

// ghost.gd is a valid ScriptPath in the stub registry, but no such file exists in sample/scripts/.
const scene: SceneNode = {
  name: "Main",
  type: "Node2D",
  children: [{ name: "Ghost", type: "Node2D", script: "res://scripts/ghost.gd" }],
};

export default scene;
