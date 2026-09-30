// Turns a scene definition into a flat JSON list of what Godot should find after loading the emitted scene.
// Used by verify-scene.gd as an independent check: the tree (intent) against what Godot actually loaded.
// Run: bun export-expected.ts scene-defs/main.def.ts > expected.json   (verify.ts does this for you)
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

type Value = number | boolean | string | { raw: string } | { ext: string } | { sub: { type: string; props?: Record<string, Value> } };
type Node = { name: string; type: string; script?: string; props?: Record<string, Value>; scriptProps?: Record<string, Value>; children?: Node[] };

const encode = (v: Value): unknown => {
  if (typeof v === "number") return { kind: "number", value: v };
  if (typeof v === "boolean") return { kind: "bool", value: v };
  if (typeof v === "string") return { kind: "string", value: v };
  if ("raw" in v) return { kind: "raw", value: v.raw };
  if ("ext" in v) return { kind: "ext", value: v.ext };
  return { kind: "sub", type: v.sub.type, props: Object.entries(v.sub.props ?? {}).map(([key, val]) => ({ key, ...(encode(val) as object) })) };
};

export function expectedOf(tree: Node): unknown[] {
  const flat: unknown[] = [];
  const walk = (node: Node, path: string) => {
    const props = { ...node.props, ...node.scriptProps };
    flat.push({
      path,
      type: node.type,
      script: node.script ?? null,
      props: Object.entries(props).map(([key, val]) => ({ key, ...(encode(val) as object) })),
    });
    for (const child of node.children ?? []) walk(child, path === "." ? child.name : `${path}/${child.name}`);
  };
  walk(tree, ".");
  return flat;
}

if (import.meta.main) {
  const mod = await import(pathToFileURL(resolve(process.argv[2]!)).href);
  console.log(JSON.stringify(expectedOf(mod.default as Node)));
}
