// One command for the day-to-day loop. Run from the game's root folder:
//   bun engine/packages/build/src/build.ts [--watch] [--force]
//
// 1. tstogd convert        TypeScript scripts -> GDScript (skipped if the project has no tstogd.json)
// 2. registry              regenerate scene-defs/registry.gen.ts (paths as types)
// 3. scenes                for each scene-defs/*.def.ts: validate (errors stop the build), then write its `output` scene
// 4. tstogd convert again  only if a scene changed, so scripts see the new scene's typings
//
// A definition file `export default`s the scene tree and `export const output = "scenes/x.tscn"`.
// --force  overwrite a scene even if it was changed outside this tool (see guard.ts)
// --watch  keep running: rebuild scenes when a definition changes; tstogd and the registry run in watch mode too

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, watch, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emitTscn } from "../../emitter/tools/emit-tscn.ts";
import { validate } from "../../validator/tools/validate-scene.ts";
import { decideWrite, sha } from "./guard.ts";

const ROOT = process.cwd();
const DEFS = join(ROOT, "scene-defs");
const STATE = join(DEFS, ".emitted.json"); // path -> hash of what we last wrote (commit it: it is shared state)
const REGISTRY_TOOL = fileURLToPath(new URL("../../registry/tools/gen-registry.ts", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);
const force = args.includes("--force");

const say = (step: string, text: string) => console.log(`${step.padEnd(12)} ${text}`);
const hasTstogd = existsSync(join(ROOT, "tstogd.json"));

function convert(): { ok: boolean; note: string } {
  const r = spawnSync("npx", ["tstogd", "convert"], { cwd: ROOT, encoding: "utf8" });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const errors = out.match(/(\d+) error\(s\)/g)?.join(", ");
  return { ok: r.status === 0 && !errors, note: errors ?? "no issues" };
}

async function buildScenes(): Promise<{ failed: boolean; changed: boolean }> {
  const files = existsSync(DEFS) ? readdirSync(DEFS).filter((f) => f.endsWith(".def.ts")).sort() : [];
  if (files.length === 0) { say("scenes", "no scene-defs/*.def.ts found"); return { failed: false, changed: false }; }
  const state: Record<string, string> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  let failed = false, changed = false;

  for (const file of files) {
    const name = file.replace(/\.def\.ts$/, "");
    try {
      const mod = await import(pathToFileURL(join(DEFS, file)).href);
      const tree = mod.default, output: unknown = mod.output;
      if (!tree || typeof output !== "string") throw new Error('needs `export default` (the scene) and `export const output = "scenes/x.tscn"`');

      const issues = validate(tree);
      for (const i of issues) console.log(`             ${i.severity}: ${i.path}: ${i.message}`);
      if (issues.some((i) => i.severity === "error")) { say("scenes", `${name}: FAILED validation, nothing written`); failed = true; continue; }

      const text = emitTscn(tree);
      const target = resolve(ROOT, output);
      const existing = existsSync(target) ? readFileSync(target, "utf8") : null;
      const decision = decideWrite({ existing, lastHash: state[output], next: text, force });
      if (decision === "blocked-edited" || decision === "blocked-unknown") {
        const why = decision === "blocked-edited" ? "was changed after this tool wrote it (edited in Godot?)" : "exists but this tool never wrote it";
        say("scenes", `${name}: NOT WRITTEN: ${output} ${why}. Move your edits into ${file}, or rerun with --force to overwrite.`);
        failed = true; continue;
      }
      if (decision !== "unchanged") { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text); changed = true; }
      state[output] = sha(text);
      say("scenes", `${name}: ${decision}${issues.length ? ` (${issues.length} warning${issues.length > 1 ? "s" : ""})` : ""} -> ${output}`);
    } catch (err) {
      say("scenes", `${name}: FAILED to load: ${err instanceof Error ? err.message : err}`);
      failed = true;
    }
  }
  writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
  return { failed, changed };
}

// ---- entry points ---------------------------------------------------------------------------------

if (args.includes("--scenes-only")) {
  // used by --watch: a fresh process per rebuild, so edited definitions and the registry are never served from a module cache
  const { failed } = await buildScenes();
  process.exit(failed ? 1 : 0);
}

const t0 = Date.now();
let failed = false;
let firstConvertOk = true;

if (hasTstogd) {
  const c = convert();
  firstConvertOk = c.ok;
  say("convert", `${c.ok ? "ok" : "issues"} (${c.note})`);
} else say("convert", "skipped (no tstogd.json)");

const reg = spawnSync(process.execPath, [REGISTRY_TOOL, ROOT, "--out", join(DEFS, "registry.gen.ts")], { cwd: ROOT, encoding: "utf8" });
if (reg.status !== 0) { say("registry", `FAILED: ${(reg.stderr || reg.stdout).trim().split("\n")[0]}`); failed = true; }
else say("registry", reg.stdout.startsWith("unchanged") ? "unchanged" : "regenerated");

if (!failed) {
  // the scene step is a separate process for the same reason as in --watch
  const s = spawnSync(process.execPath, [SELF, "--scenes-only", ...(force ? ["--force"] : [])], { cwd: ROOT, encoding: "utf8" });
  process.stdout.write(s.stdout);
  if (s.status !== 0) failed = true;
  const changed = /: (create|overwrite) ->/.test(s.stdout);
  if (hasTstogd && !failed && (changed || !firstConvertOk)) {
    const c = convert();
    say("convert", `again, for new typings: ${c.ok ? "ok" : "ISSUES"} (${c.note})`);
    if (!c.ok) failed = true;
  }
}

console.log(`${failed ? "BUILD FAILED" : "build ok"} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (args.includes("--watch") && !failed) {
  const kids = [
    ...(hasTstogd ? [spawn("npx", ["tstogd", "watch"], { cwd: ROOT, stdio: "ignore" })] : []),
    spawn(process.execPath, [REGISTRY_TOOL, ROOT, "--out", join(DEFS, "registry.gen.ts"), "--watch"], { cwd: ROOT, stdio: "ignore" }),
  ];
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(DEFS, (_e, name) => {
    if (!name || !name.endsWith(".def.ts")) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const s = spawnSync(process.execPath, [SELF, "--scenes-only", ...(force ? ["--force"] : [])], { cwd: ROOT, encoding: "utf8" });
      console.log(`\n[${new Date().toLocaleTimeString()}] ${name} changed`);
      process.stdout.write(s.stdout);
    }, 300);
  });
  console.log("watching scene-defs/*.def.ts (tstogd and the registry watch too). Ctrl-C to stop.");
  const stop = () => { kids.forEach((k) => k.kill()); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
} else {
  process.exit(failed ? 1 : 0);
}
