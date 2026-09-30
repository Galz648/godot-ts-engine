// The main scene, described in TypeScript. `npm run build` checks it and writes scenes/main.tscn.
// Node classes can only be real Godot classes; script and texture paths only ones the registry found (registry.gen.ts).
import type { SceneNode } from "../engine/packages/scene/src/index.ts";
import type { NodeType } from "../engine/packages/validator/src/node-types.gen.ts";
import { Scripts, type ScriptPath, type TexturePath } from "./registry.gen.ts";

type GameNode = SceneNode<{ type: NodeType; script: ScriptPath; texture: TexturePath }>;

const scene: GameNode = {
  name: "Main",
  type: "Node2D",
  children: [
    {
      name: "Background",
      type: "ColorRect",
      props: { offset_right: 1152, offset_bottom: 648, color: { raw: "Color(0.08, 0.09, 0.12, 1)" } },
    },
    {
      name: "Player",
      type: "ColorRect",
      script: Scripts.player,
      props: { offset_left: 560, offset_top: 308, offset_right: 592, offset_bottom: 340, color: { raw: "Color(0.96, 0.76, 0.32, 1)" } },
    },
    {
      name: "Hint",
      type: "Label",
      props: { offset_left: 24, offset_top: 16, offset_right: 824, offset_bottom: 48, text: "{{name}}: arrows or WASD to move" },
    },
  ],
};

export default scene;

export const output = "scenes/main.tscn";
