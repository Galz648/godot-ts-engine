import type { SceneNode } from "../../scene/src/index.ts";
import type { ScriptPath, TexturePath } from "../src/paths.ts";

// Narrow vocabulary: script and texture paths must be ones the (stub) registry knows about.
type Vocab = { type: string; script: ScriptPath; texture: TexturePath };

const scene: SceneNode<Vocab> = {
  name: "Main",
  type: "Node2D",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: "res://scripts/ball.gd",
      props: { position: { raw: "Vector2(320, 180)" } },
      children: [{ name: "Sprite", type: "Sprite2D", props: { texture: { ext: "res://art/ball.png" } } }],
    },
  ],
};

export default scene;
