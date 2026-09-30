// Writes a Godot 4 .tscn from a scene tree described as plain TypeScript data.
// The emitter trusts its input (checking the tree is PoC 3) and never touches script bodies.
//
// Usage: bun tools/emit-tscn.ts <tree-definition.ts> <out.tscn>     (Node built-ins only)
//   The definition file must `export default` a SceneNode (a named export `scene` also works).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PropValue, SceneNode, SubResource } from "../../scene/src/index.ts";

// The scene types live in packages/scene (shared with the validator). Re-exported so existing imports keep working.
export type { PropValue, SceneNode, SubResource };

// ---- emitter ---------------------------------------------------------------------------------

export function emitTscn(root: SceneNode): string {
  // Resources are numbered in the order they are first used while the tree is written, so output is stable.
  const exts = new Map<string, { id: string; type: string }>(); // res:// path -> entry, in id order
  const subs: { id: string; type: string; lines: string[] }[] = []; // dependencies come before their users

  const extId = (path: string, type: string): string => {
    let entry = exts.get(path);
    if (!entry) {
      const stem = basename(path).replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9_]/g, "_");
      entry = { id: `${exts.size + 1}_${stem}`, type };
      exts.set(path, entry);
    }
    return entry.id;
  };

  const propLines = (props: Record<string, PropValue> = {}): string[] =>
    Object.entries(props).map(([key, value]) => `${key} = ${printValue(value)}`);

  const printValue = (v: PropValue): string => {
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new Error(`cannot emit ${v} as a Godot number`);
      return String(v);
    }
    if (typeof v === "boolean") return String(v);
    if (typeof v === "string") return JSON.stringify(v);
    if ("raw" in v) return v.raw;
    if ("ext" in v) return `ExtResource("${extId(v.ext, "Texture2D")}")`;
    const lines = propLines(v.sub.props); // registers any nested resources first
    const id = `${v.sub.type}_${subs.length + 1}`;
    subs.push({ id, type: v.sub.type, lines });
    return `SubResource("${id}")`;
  };

  const nodeBlocks: string[] = [];
  const walk = (node: SceneNode, parent: string | null): void => {
    const where = parent === null ? "" : ` parent="${parent}"`;
    const lines = [`[node name="${node.name}" type="${node.type}"${where}]`, ...propLines(node.props)];
    if (node.script) lines.push(`script = ExtResource("${extId(node.script, "Script")}")`);
    lines.push(...propLines(node.scriptProps)); // after the script line: Godot drops these silently if they come before it
    nodeBlocks.push(lines.join("\n"));

    // root's children use ".", deeper nodes use the path from the root: "Ball", "Ball/Sprite"
    const myPath = parent === null ? "." : parent === "." ? node.name : `${parent}/${node.name}`;
    for (const child of node.children ?? []) walk(child, myPath);
  };
  walk(root, null);

  const resourceCount = exts.size + subs.length;
  const out = [resourceCount === 0 ? "[gd_scene format=3]" : `[gd_scene load_steps=${resourceCount + 1} format=3]`];
  if (exts.size > 0) {
    out.push([...exts].map(([path, e]) => `[ext_resource type="${e.type}" path="${path}" id="${e.id}"]`).join("\n"));
  }
  for (const s of subs) out.push([`[sub_resource type="${s.type}" id="${s.id}"]`, ...s.lines].join("\n"));
  out.push(...nodeBlocks);
  return out.join("\n\n") + "\n"; // always LF, so output is identical on Windows
}

// ---- command line ----------------------------------------------------------------------------

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const [defPath, outPath] = process.argv.slice(2);
  if (!defPath || !outPath) {
    console.error("usage: bun tools/emit-tscn.ts <tree-definition.ts> <out.tscn>");
    process.exit(1);
  }
  const mod = await import(pathToFileURL(resolve(defPath)).href);
  const root: SceneNode | undefined = mod.default ?? mod.scene;
  if (!root) {
    console.error(`${defPath} must export default (or export const scene) a SceneNode`);
    process.exit(1);
  }

  const text = emitTscn(root);
  const out = resolve(outPath);
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out) && readFileSync(out, "utf8") === text) console.log(`unchanged ${out}`);
  else {
    writeFileSync(out, text);
    console.log(`wrote ${out}`);
  }
}
