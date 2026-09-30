// What did an editing session do to a scene, and what would syncing it back into TypeScript cost?
// Usage: bun src/analyze.ts <base.tscn> <edited.tscn>
//   base   = the scene as the tool wrote it      edited = the same file after someone saved it in the Godot editor
import { readFileSync } from "node:fs";
import { emitTscn } from "../../emitter/tools/emit-tscn.ts";
import { flatten, merge3 } from "./merge.ts";
import { parseTscn } from "./parse.ts";

const [baseFile, editedFile] = process.argv.slice(2);
if (!baseFile || !editedFile) { console.error("usage: bun src/analyze.ts <base.tscn> <edited.tscn>"); process.exit(2); }

const base = parseTscn(readFileSync(baseFile, "utf8"));
const edited = parseTscn(readFileSync(editedFile, "utf8"));
const B = flatten(base.root), T = flatten(edited.root);
const show = (v: unknown) => JSON.stringify(v);

console.log(`edited scene: ${T.size} nodes (base: ${B.size})`);
console.log("\nchanges, as the model sees them:");
let changes = 0;
for (const [p, t] of T) {
  const b = B.get(p);
  if (!b) { console.log(`  + added node ${p} (${t.type})`); changes++; continue; }
  for (const bag of ["props", "scriptProps"] as const) {
    for (const k of new Set([...Object.keys(b[bag] ?? {}), ...Object.keys(t[bag] ?? {})])) {
      if (show(b[bag]?.[k]) !== show(t[bag]?.[k])) { console.log(`  ~ ${p}: ${k}  ${show(b[bag]?.[k])} -> ${show(t[bag]?.[k])}`); changes++; }
    }
  }
  if (b.type !== t.type) { console.log(`  ~ ${p}: class ${b.type} -> ${t.type}`); changes++; }
  if (b.script !== t.script) { console.log(`  ~ ${p}: script ${b.script} -> ${t.script}`); changes++; }
  const common = (xs: string[], ys: string[]) => xs.filter((x) => ys.includes(x));
  if (show(common(b.children, t.children)) !== show(common(t.children, b.children))) { console.log(`  ~ ${p}: children reordered ${show(b.children)} -> ${show(t.children)} (order is not merged)`); changes++; }
}
for (const p of B.keys()) if (!T.has(p)) { console.log(`  - node ${p} is gone (a rename shows up as this plus an add)`); changes++; }
if (changes === 0) console.log("  (none the model can see)");

console.log(`\nsaved by the editor, not representable in the model (${edited.unsupported.length}):`);
for (const u of edited.unsupported) console.log(`  ! ${u}`);
if (edited.unsupported.length === 0) console.log("  (nothing)");
console.log(`metadata the model ignores (harmless): ${edited.ignored.join(", ") || "none"}`);

const { merged, conflicts } = merge3(base.root, base.root, edited.root); // TypeScript unchanged: what comes back?
const back = emitTscn(merged);
const direct = emitTscn(edited.root);
console.log(`\nmerge with an unchanged TypeScript tree: ${conflicts.length} conflict(s); result ${back === direct ? "equals" : "DIFFERS from"} the edited scene as the model reads it`);
for (const c of conflicts) console.log(`  conflict at ${c.path}: ${c.what}`);
console.log(`\nverdict: writing this scene back from TypeScript would ${edited.unsupported.length === 0 ? "lose nothing the editor did" : `LOSE ${edited.unsupported.length} thing(s) listed above`}.`);
