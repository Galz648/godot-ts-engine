// The other direction: a scene tree (read from a .tscn by parse.ts) written out as a `scene-defs/*.def.ts` file, so a
// scene changed in the Godot editor can become the TypeScript definition again (`npm run pull`). Script and texture paths
// are written as registry keys (`Scripts.player`) when the registry knows them, as plain strings otherwise (then TypeScript
// flags them, which is the point). Helper functions and loops of a hand-written definition do not survive: the result is
// one literal tree.
import type { PropValue, SceneNode } from "../../scene/src/index.ts";

export type Registry = { Scripts?: Record<string, string>; Textures?: Record<string, string> };

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const key = (k: string) => (IDENT.test(k) ? k : JSON.stringify(k));

export function writeDef(root: SceneNode, opts: { output: string; registry?: Registry; header?: string[] }): string {
  const byPath = (table?: Record<string, string>) => new Map(Object.entries(table ?? {}).map(([k, p]) => [p, k]));
  const scripts = byPath(opts.registry?.Scripts), textures = byPath(opts.registry?.Textures);
  const ref = (table: Map<string, string>, name: string, path: string) => {
    const k = table.get(path);
    return k === undefined ? JSON.stringify(path) : IDENT.test(k) ? `${name}.${k}` : `${name}[${JSON.stringify(k)}]`;
  };

  const value = (v: PropValue): string => {
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "string") return JSON.stringify(v);
    if ("raw" in v) return `{ raw: ${JSON.stringify(v.raw)} }`;
    if ("ext" in v) return `{ ext: ${ref(textures, "Textures", v.ext)} }`;
    const props = v.sub.props && Object.keys(v.sub.props).length ? `, props: ${bag(v.sub.props)}` : "";
    return `{ sub: { type: ${JSON.stringify(v.sub.type)}${props} } }`;
  };
  const bag = (b: Record<string, PropValue>) => `{ ${Object.entries(b).map(([k, v]) => `${key(k)}: ${value(v)}`).join(", ")} }`;

  const node = (n: SceneNode, indent: string): string => {
    const i = indent + "  ";
    const fields = [`name: ${JSON.stringify(n.name)}`, `type: ${JSON.stringify(n.type)}`];
    if (n.script !== undefined) fields.push(`script: ${ref(scripts, "Scripts", n.script)}`);
    if (n.props && Object.keys(n.props).length) fields.push(`props: ${bag(n.props)}`);
    if (n.scriptProps && Object.keys(n.scriptProps).length) fields.push(`scriptProps: ${bag(n.scriptProps)}`);
    const oneLine = `${indent}{ ${fields.join(", ")} }`;
    if (!n.children?.length && oneLine.length <= 120) return oneLine;
    const lines = fields.map((f) => `${i}${f},`);
    if (n.children?.length) lines.push(`${i}children: [`, ...n.children.map((c) => `${node(c, i + "  ")},`), `${i}],`);
    return [`${indent}{`, ...lines, `${indent}}`].join("\n");
  };

  return [
    ...(opts.header ?? []).map((h) => `// ${h}`),
    `import type { SceneNode } from "../engine/packages/scene/src/index.ts";`,
    `import type { NodeType } from "../engine/packages/validator/src/node-types.gen.ts";`,
    `import { Scripts, Textures, type ScriptPath, type TexturePath } from "./registry.gen.ts";`,
    ``,
    `type GameNode = SceneNode<{ type: NodeType; script: ScriptPath; texture: TexturePath }>;`,
    ``,
    `const scene: GameNode = ${node(root, "").trimStart()};`,
    ``,
    `export default scene;`,
    ``,
    `export const output = ${JSON.stringify(opts.output)};`,
    ``,
  ].join("\n");
}
