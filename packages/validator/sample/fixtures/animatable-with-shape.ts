import type { SceneNode } from "../../tools/scene-node.ts";

// A shape under an AnimatableBody2D. Godot accepts this (see godot-check/animatable-with-shape.tscn).
const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  children: [{ name: "Platform", type: "AnimatableBody2D", children: [{ name: "Shape", type: "CollisionShape2D", props: { shape: { raw: 'SubResource("CircleShape2D_1")' } } }] }],
};

export default tree;
