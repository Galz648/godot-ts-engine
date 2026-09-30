// One tree, typed once with the shared SceneNode, passed to BOTH the validator and the emitter.
// This is the smallest form of "the tools work together": same data in, findings and a .tscn out.
// Run: bun run demo
import { emitTscn } from "../../emitter/tools/emit-tscn.ts";
import { validate } from "../../validator/tools/validate-scene.ts";
import type { SceneNode } from "../src/index.ts";

const good: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: "res://scripts/ball.gd",
      props: { position: { raw: "Vector2(320, 180)" } },
      children: [
        { name: "Shape", type: "CollisionShape2D", props: { shape: { sub: { type: "CircleShape2D", props: { radius: 8 } } } } },
        { name: "Sprite", type: "Sprite2D", props: { texture: { ext: "res://art/ball.png" } } },
      ],
    },
  ],
};

// The same tree with the collision shape removed: valid TypeScript, but Godot would warn.
const broken: SceneNode = {
  ...good,
  children: [{ ...good.children![0], children: [good.children![0].children![1]] }],
};

for (const [label, tree] of [["good", good], ["broken", broken]] as const) {
  const issues = validate(tree);
  console.log(`\n== ${label} tree: validator found ${issues.length} issue(s)`);
  for (const i of issues) console.log(`   ${i.severity}: ${i.path}: ${i.message}`);
  const tscn = emitTscn(tree);
  console.log(`   emitter wrote ${tscn.split("\n").length - 1} lines; nodes: ${(tscn.match(/^\[node /gm) ?? []).length}`);
}
