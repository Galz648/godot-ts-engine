// What differs between two scene trees, in words: used to tell you how far a definition is behind its scene.
// Nodes are matched by path, so a rename reads as one node gone and one added.
import type { SceneNode } from "../../scene/src/index.ts";
import { flatten } from "./merge.ts";

const show = (v: unknown): string =>
  v === undefined ? "(none)"
  : typeof v === "object" && v !== null && "raw" in v ? String(v.raw)
  : typeof v === "object" && v !== null && "ext" in v ? String(v.ext)
  : JSON.stringify(v);

/** Differences from `from` to `to`, e.g. `Ball: offset_left 568 -> 500`, `+ Timer (Timer)`. Empty when they match. */
export function diffTrees(from: SceneNode, to: SceneNode): string[] {
  const A = flatten(from), B = flatten(to);
  const out: string[] = [];
  for (const [p, b] of B) {
    const a = A.get(p);
    if (!a) { out.push(`+ ${p} (${b.type})`); continue; }
    if (a.type !== b.type) out.push(`${p}: class ${a.type} -> ${b.type}`);
    if (a.script !== b.script) out.push(`${p}: script ${show(a.script)} -> ${show(b.script)}`);
    for (const bagName of ["props", "scriptProps"] as const) {
      const x = a[bagName] ?? {}, y = b[bagName] ?? {};
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (show(x[k]) !== show(y[k])) out.push(`${p}: ${bagName === "scriptProps" ? "script variable " : ""}${k} ${show(x[k])} -> ${show(y[k])}`);
      }
    }
    const common = (xs: string[], ys: string[]) => xs.filter((n) => ys.includes(n));
    if (show(common(a.children, b.children)) !== show(common(b.children, a.children))) out.push(`${p}: children reordered`);
  }
  for (const p of A.keys()) if (!B.has(p)) out.push(`- ${p}`);
  return out;
}
