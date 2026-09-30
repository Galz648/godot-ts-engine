// Walks a declarative scene tree and returns a list of problems with human-written messages.
// Structural rules are plain functions in the RULES array: to add a rule, add a function.
//
// CLI:  node tools/validate-scene.ts <tree-file.ts>     (the file's default export is the root SceneNode)
//       bun  tools/validate-scene.ts <tree-file.ts>

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SceneNode } from "./scene-node.ts";

export type Issue = {
  severity: "error" | "warning";
  rule: string; //    e.g. "body-needs-shape"
  path: string; //    "Ball/Sprite", relative to the root ("." is the root itself)
  message: string; // written for a human, says how to fix it
  node: SceneNode; // the exact object from the input tree, so PoC 4 can find its source position
};

// A rule looks at one node (and its parent) and returns zero or more issues.
// Rules leave `path` empty; validate() fills it in, because only the walk knows where a node is.
export type Rule = (node: SceneNode, parent: SceneNode | null) => Issue[];

const BODY_TYPES = ["CharacterBody2D", "RigidBody2D", "StaticBody2D", "Area2D"];
const SHAPE_TYPES = ["CollisionShape2D", "CollisionPolygon2D"];
const ILLEGAL_NAME_CHARS = [".", ":", "@", "/", '"', "%"];

function issue(severity: Issue["severity"], rule: string, node: SceneNode, message: string): Issue[] {
  return [{ severity, rule, path: "", message, node }];
}

// ---- rules ---------------------------------------------------------------------------------------

const uniqueSiblingNames: Rule = (node, parent) => {
  const siblings = parent?.children ?? [];
  const firstWithName = siblings.findIndex((s) => s.name === node.name);
  if (firstWithName === -1 || firstWithName === siblings.indexOf(node)) return [];
  return issue("error", "unique-sibling-names", node,
    `Another child of "${parent!.name}" is already called "${node.name}". Sibling names must be unique; rename one of them.`);
};

const validName: Rule = (node) => {
  if (typeof node.name !== "string" || node.name === "") {
    return issue("error", "valid-name", node, "This node has an empty name. Give it a name.");
  }
  const bad = ILLEGAL_NAME_CHARS.filter((c) => node.name.includes(c));
  if (bad.length === 0) return [];
  return issue("error", "valid-name", node,
    `The name "${node.name}" contains ${bad.map((c) => `"${c}"`).join(" ")}, which Godot does not allow in node names ` +
    `(not allowed: ${ILLEGAL_NAME_CHARS.join(" ")}). Rename it.`);
};

// The three shape rules and the sprite rule use Godot's own configuration-warning wording where Godot has one.

const bodyNeedsShape: Rule = (node) => {
  if (!BODY_TYPES.includes(node.type)) return [];
  if ((node.children ?? []).some((c) => SHAPE_TYPES.includes(c.type))) return [];
  return issue("warning", "body-needs-shape", node,
    "This node has no shape, so it can't collide or interact with other objects. " +
    "Consider adding a CollisionShape2D or CollisionPolygon2D as a child to define its shape.");
};

const shapeNeedsBody: Rule = (node, parent) => {
  if (node.type !== "CollisionShape2D") return [];
  if (parent && BODY_TYPES.includes(parent.type)) return [];
  return issue("warning", "shape-needs-body", node,
    "CollisionShape2D only serves to provide a collision shape to a CollisionObject2D derived node. " +
    "Please only use it as a child of Area2D, StaticBody2D, RigidBody2D, CharacterBody2D, etc. to give them a shape.");
};

const shapeNeedsShapeProp: Rule = (node) => {
  if (node.type !== "CollisionShape2D" || node.props?.shape != null) return [];
  return issue("warning", "shape-needs-shape-prop", node,
    'A shape must be provided for CollisionShape2D to function. Please create a shape resource for it! (Set the "shape" prop.)');
};

// Godot itself shows no configuration warning for this one; it is here because the handover asks for it.
const spriteNeedsTexture: Rule = (node) => {
  if (node.type !== "Sprite2D" || node.props?.texture != null) return [];
  return issue("warning", "sprite-needs-texture", node, 'This Sprite2D has no texture, so nothing will be drawn. Set the "texture" prop.');
};

export const RULES: Rule[] = [uniqueSiblingNames, validName, bodyNeedsShape, shapeNeedsBody, shapeNeedsShapeProp, spriteNeedsTexture];

// ---- the walk ------------------------------------------------------------------------------------

// Never throws: a broken tree or a crashing rule becomes an "internal-error" issue instead.
export function validate(root: SceneNode): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<SceneNode>(); // guards against a node that contains itself

  const walk = (node: SceneNode, parent: SceneNode | null, segments: string[]) => {
    if (seen.has(node)) return;
    seen.add(node);
    const path = segments.length === 0 ? "." : segments.join("/");

    for (const rule of RULES) {
      try {
        for (const found of rule(node, parent)) issues.push({ ...found, path });
      } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        issues.push({ severity: "error", rule: "internal-error", path, node, message: `A validation rule crashed on this node: ${why}` });
      }
    }

    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) {
      if (child === null || typeof child !== "object") {
        issues.push({ severity: "error", rule: "internal-error", path, node, message: "children contains something that is not a node." });
        continue;
      }
      const name = typeof child.name === "string" && child.name !== "" ? child.name : "<unnamed>";
      walk(child, node, [...segments, name]);
    }
  };

  if (root === null || typeof root !== "object") {
    return [{ severity: "error", rule: "internal-error", path: ".", node: root, message: "The scene root is not a node object." }];
  }
  walk(root, null, []);
  return issues;
}

// ---- CLI -----------------------------------------------------------------------------------------

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node tools/validate-scene.ts <tree-file.ts>   (default export = the root SceneNode)");
    process.exit(2);
  }

  let tree: SceneNode;
  try {
    tree = (await import(pathToFileURL(resolve(file)).href)).default;
  } catch (err) {
    console.error(`could not load ${file}: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }

  const issues = validate(tree);
  for (const i of issues) console.log(`${i.severity}: ${i.path}: ${i.message}`);
  const errors = issues.filter((i) => i.severity === "error").length;
  console.log(issues.length === 0 ? "ok: no issues" : `${errors} error(s), ${issues.length - errors} warning(s)`);
  process.exit(errors > 0 ? 1 : 0);
}
