// The main scene, described in TypeScript. `npm run build` checks it and writes scenes/main.tscn, until you first save
// that scene in Godot; from then on Godot owns it (scaffold once, see README.md) and the build tells you when this file
// and the scene disagree. `npm run pull` rewrites this file from the scene.
// Node classes can only be real Godot classes; script and texture paths only ones the registry found (registry.gen.ts).
import type { SceneNode } from "../engine/packages/scene/src/index.ts";
import type { NodeType } from "../engine/packages/validator/src/node-types.gen.ts";
import { Scripts, Textures, type ScriptPath, type TexturePath } from "./registry.gen.ts";

type GameNode = SceneNode<{ type: NodeType; script: ScriptPath; texture: TexturePath }>;

const vec = (x: number, y: number) => ({ raw: `Vector2(${x}, ${y})` });

const scene: GameNode = {
  name: "Main",
  type: "Node2D",
  script: Scripts.main,
  children: [
    {
      name: "Background",
      type: "ColorRect",
      props: { offset_right: 1152, offset_bottom: 648, color: { raw: "Color(0.08, 0.09, 0.12, 1)" } },
    },
    {
      name: "Player",
      type: "CharacterBody2D",
      script: Scripts.player,
      props: { position: vec(200, 324), motion_mode: 1 }, // 1 = floating: top-down, no floor
      children: [
        { name: "Sprite", type: "Sprite2D", props: { texture: { ext: Textures.player } } },
        { name: "Shape", type: "CollisionShape2D", props: { shape: { sub: { type: "RectangleShape2D", props: { size: vec(36, 36) } } } } },
      ],
    },
    {
      name: "Coin",
      type: "Area2D",
      script: Scripts.coin,
      props: { position: vec(760, 324) },
      scriptProps: { value: 5 }, // Coin's `@exports value`, set per coin here
      children: [
        { name: "Sprite", type: "Sprite2D", props: { texture: { ext: Textures.coin } } },
        { name: "Shape", type: "CollisionShape2D", props: { shape: { sub: { type: "CircleShape2D", props: { radius: 14 } } } } },
      ],
    },
    {
      name: "Hud",
      type: "CanvasLayer",
      children: [
        { name: "Score", type: "Label", props: { offset_left: 24, offset_top: 16, offset_right: 424, offset_bottom: 48, text: "Score 0" } },
        { name: "Hint", type: "Label", props: { offset_left: 24, offset_top: 600, offset_right: 824, offset_bottom: 632, text: "{{name}}: arrows or WASD, collect the coin" } },
      ],
    },
  ],
};

export default scene;

export const output = "scenes/main.tscn";
