// Everything here must compile: plain-string trees, narrow trees, and narrow passed where wide is expected.
import type { SceneNode } from "../src/index.ts";

// 1. default vocabulary: all strings
export const plain: SceneNode = {
  name: "Main",
  type: "Node2D",
  children: [{ name: "Ball", type: "CharacterBody2D", script: "res://scripts/ball.gd", props: { position: { raw: "Vector2(1, 2)" } } }],
};

// 2. a game's narrow vocabulary
type Game = { type: "Node2D" | "Sprite2D"; script: "res://scripts/ball.gd"; texture: "res://art/ball.png" };
export const narrow: SceneNode<Game> = {
  name: "Main",
  type: "Node2D",
  children: [{ name: "Sprite", type: "Sprite2D", props: { texture: { ext: "res://art/ball.png" } } }],
};

// 3. narrow is accepted where the plain version is expected: this is what lets one validator/emitter serve every game
export const widened: SceneNode = narrow;

// 4. resources inside resources
export const withShape: SceneNode = {
  name: "Body",
  type: "CollisionShape2D",
  props: { shape: { sub: { type: "RectangleShape2D", props: { size: { raw: "Vector2(16, 16)" } } } } },
};
