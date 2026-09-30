// How a game uses the path registry with the shared scene type: build a "vocabulary" from the generated files,
// then type the scene with it. Script and texture paths can only be ones that exist; node classes can only be real.
// Here the registry is the one generated for packages/registry/sample; in a game it is the game's own generated file.
// Run: bun run demo:registry
import { emitTscn } from "../../emitter/tools/emit-tscn.ts";
import { Scripts, Textures, type ScriptPath, type TexturePath } from "../../registry/src/registry.gen.ts";
import { validate } from "../../validator/tools/validate-scene.ts";
import type { NodeType } from "../../validator/src/node-types.gen.ts";
import type { SceneNode } from "../src/index.ts";

// The three lines that connect a game's generated files to the scene type:
type Vocab = { type: NodeType; script: ScriptPath; texture: TexturePath };
type GameNode = SceneNode<Vocab>;

const scene: GameNode = {
  name: "Main",
  type: "Node2D",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: Scripts.ball, //                       or the literal "res://scripts/ball.gd": both are checked
      children: [
        { name: "Shape", type: "CollisionShape2D", props: { shape: { sub: { type: "CircleShape2D", props: { radius: 8 } } } } },
        { name: "Sprite", type: "Sprite2D", props: { texture: { ext: Textures.ball } } },
      ],
    },
  ],
};

const issues = validate(scene);
console.log(`validator: ${issues.length} issue(s)`);
console.log(emitTscn(scene));
