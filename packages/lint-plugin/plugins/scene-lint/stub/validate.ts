// STUB of the PoC 3 validator. Signature guessed from the PoC 4 handover: validate(tree) -> issues,
// each with the SceneNode it is about (`node`, compared by identity) and a severity.
// Two rules only, enough to drive the plugin. Replace this import with the real validator when integrating.
import type { SceneNode } from "./types";

export interface Issue {
  node: SceneNode;
  severity: "error" | "warning";
  message: string;
}

const NEEDS_SHAPE = new Set(["CharacterBody2D", "StaticBody2D", "RigidBody2D", "AnimatableBody2D", "Area2D"]);
const SHAPES = new Set(["CollisionShape2D", "CollisionPolygon2D"]);

export function validate(root: SceneNode): Issue[] {
  const issues: Issue[] = [];

  const visit = (node: SceneNode) => {
    const children = node.children ?? [];

    if (NEEDS_SHAPE.has(node.type) && !children.some((c) => SHAPES.has(c.type))) {
      issues.push({
        node,
        severity: "warning",
        message: `${node.type} "${node.name}" has no CollisionShape2D or CollisionPolygon2D child, so it cannot collide.`,
      });
    }

    const seen = new Set<string>();
    for (const child of children) {
      if (seen.has(child.name)) {
        issues.push({ node: child, severity: "error", message: `Duplicate sibling name "${child.name}".` });
      }
      seen.add(child.name);
    }

    children.forEach(visit);
  };

  visit(root);
  return issues;
}
