// Checks every generated scene against its TypeScript definition, in Godot itself. Run from the game's root folder:
//   bun engine/packages/verify/src/verify.ts [scene-defs/x.def.ts ...]      (default: every scene-defs/*.def.ts)
//
// For each definition: export what Godot should find (export-expected.ts), load the written scene headless in Godot and
// compare node by node, property by property (verify-scene.gd). Needs `godot` (4.x) on PATH, and a built project.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expectedOf } from "./export-expected.ts";

const ROOT = process.cwd();
const GD = fileURLToPath(new URL("./verify-scene.gd", import.meta.url));
const godot = process.env.GODOT ?? "godot";

const args = process.argv.slice(2);
const defs = args.length
  ? args.map((a) => resolve(a))
  : existsSync(join(ROOT, "scene-defs"))
    ? readdirSync(join(ROOT, "scene-defs")).filter((f) => f.endsWith(".def.ts")).sort().map((f) => join(ROOT, "scene-defs", f))
    : [];
if (defs.length === 0) { console.error("verify: no scene-defs/*.def.ts found (run from the game's root folder)"); process.exit(2); }
if (spawnSync(godot, ["--version"], { encoding: "utf8" }).status !== 0) {
  console.error(`verify: cannot run "${godot}". Put Godot 4 on PATH, or set GODOT=/path/to/godot.`);
  process.exit(2);
}

const tmp = mkdtempSync(join(tmpdir(), "verify-"));
let failed = false;
for (const def of defs) {
  const name = relative(ROOT, def);
  const mod = await import(pathToFileURL(def).href);
  if (!mod.default || typeof mod.output !== "string") { console.log(`FAIL  ${name}: needs \`export default\` and \`export const output\``); failed = true; continue; }
  if (!existsSync(resolve(ROOT, mod.output))) { console.log(`FAIL  ${name}: ${mod.output} does not exist (run the build first)`); failed = true; continue; }

  const json = join(tmp, name.replace(/[\\/]/g, "_") + ".json");
  writeFileSync(json, JSON.stringify(expectedOf(mod.default)));
  const r = spawnSync(godot, ["--headless", "--path", ROOT, "-s", GD, "--", `res://${mod.output}`, json], { encoding: "utf8" });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const summary = out.match(/VERIFY nodes_expected=(\d+) checks=(\d+) problems=(\d+)/);
  if (!summary) { console.log(`FAIL  ${name}: Godot did not report a result\n${out.trim()}`); failed = true; continue; }
  const [, nodes, checks, problems] = summary;
  const ok = problems === "0";
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name} -> ${mod.output}: ${nodes} nodes, ${checks} checks, ${problems} problems`);
  for (const line of out.split("\n")) if (line.startsWith("VERIFY PROBLEM ")) console.log(`        ${line.slice(15)}`);
}
rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
