// One command for the day-to-day loop. Run from the game's root folder:
//   bun engine/packages/build/src/build.ts [--watch] [--force]
//
// 1. tstogd convert        TypeScript scripts -> GDScript (skipped if the project has no tstogd.json)
// 2. registry              regenerate scene-defs/registry.gen.ts (paths as types)
// 3. scenes                type-check scene-defs (if it has a tsconfig.json), then for each scene-defs/*.def.ts:
//                          validate (errors stop the build), then write its `output` scene
// 4. registry again        only if a scene was created, so it is listed
// 5. tstogd convert again  only if a scene changed, so scripts see the new scene's typings
//
// A definition file `export default`s the scene tree and `export const output = "scenes/x.tscn"`.
// Scaffold once: a scene is rewritten only while it is exactly what this tool last wrote. Once it is saved in Godot, the
// build does not write it (Godot owns it). It reads Godot's version back, validates it, and says whether the definition
// still matches, is behind the scene, or was changed too (a conflict). See godotOwned() below.
// --force  overwrite a scene even if it was changed outside this tool (see guard.ts): TypeScript's version wins
// --pull   rewrite the definition of each scene Godot owns from that scene: Godot's version wins
// --watch  keep running: rebuild scenes when a definition changes; tstogd and the registry run in watch mode too

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, watch, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emitTscn } from "../../emitter/tools/emit-tscn.ts";
import type { SceneNode } from "../../scene/src/index.ts";
import { diffTrees } from "../../scene-sync/src/diff.ts";
import { parseTscn } from "../../scene-sync/src/parse.ts";
import { writeDef } from "../../scene-sync/src/write-def.ts";
import { validate } from "../../validator/tools/validate-scene.ts";
import { decideWrite, defBaseOf, sha, type StateEntry, writtenOf } from "./guard.ts";

const ROOT = process.cwd();
const DEFS = join(ROOT, "scene-defs");
const STATE = join(DEFS, ".emitted.json"); // path -> hash of what we last wrote (commit it: it is shared state)
const REGISTRY_TOOL = fileURLToPath(new URL("../../registry/tools/gen-registry.ts", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);
const force = args.includes("--force");
const pull = args.includes("--pull");
if (force && pull) { console.error("--force keeps TypeScript's version and --pull keeps Godot's: pick one"); process.exit(2); }

const say = (step: string, text: string) => console.log(`${step.padEnd(12)} ${text}`);
const hasTstogd = existsSync(join(ROOT, "tstogd.json"));

function typingsHash(): string {
  let dir = "src/_typings";
  try { dir = JSON.parse(readFileSync(join(ROOT, "tstogd.json"), "utf8")).typingsDir ?? dir; } catch {}
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return "";
  const files = (readdirSync(abs, { recursive: true }) as string[]).filter((f) => f.endsWith(".ts")).sort();
  return sha(files.map((f) => f + "\0" + readFileSync(join(abs, f), "utf8")).join("\0"));
}

/** tstogd writes a scene's typings during a convert but type-checks against the ones it started with, so a convert that
 * changed the typings is repeated (at most twice) until the check has seen the current ones. */
function convert(): { ok: boolean; note: string; details: string[] } {
  let result = { ok: false, note: "", details: [] as string[] };
  for (let pass = 0; pass < 3; pass++) {
    const before = typingsHash();
    const r = spawnSync("npx", ["tstogd", "convert"], { cwd: ROOT, encoding: "utf8" });
    const out = (r.stdout ?? "") + (r.stderr ?? "");
    const errors = out.match(/(\d+) error\(s\)/g)?.join(", ");
    const lines = out.split("\n");
    const details = lines.flatMap((l, i) => (/^\[(TS|GD):error\]/.test(l) ? [`${relative(ROOT, l.replace(/^\[\w+:error\] /, ""))}: ${(lines[i + 1] ?? "").trim()}`] : []));
    result = { ok: r.status === 0 && !errors, note: errors ?? "no issues", details };
    if (typingsHash() === before) break;
  }
  return result;
}

/**
 * A scene saved in Godot since we wrote it. Godot's version is read back, validated, and compared with the definition:
 *   same                          -> "owned by Godot; definition matches"
 *   scene changed, definition not -> the definition is behind: say how, suggest --pull
 *   both changed                  -> a conflict (fails the build): --pull keeps Godot's, --force keeps TypeScript's
 * --pull rewrites the definition from the scene. If the model can hold everything in the scene, TypeScript owns it again
 * (the scene is rewritten from the new definition). If not (groups, connections, instances), Godot keeps it and the
 * definition is a mirror.
 */
async function godotOwned(a: { name: string; file: string; output: string; tree: SceneNode; text: string; existing: string; entry: StateEntry | undefined }):
  Promise<{ failed?: boolean; changed?: boolean; state?: StateEntry }> {
  const { name, file, output } = a;
  let parsed: ReturnType<typeof parseTscn>;
  try { parsed = parseTscn(a.existing); } catch (err) {
    say("scenes", `${name}: owned by Godot; could not read ${output} back (${err instanceof Error ? err.message : err}); skipped`);
    return {};
  }
  const issues = validate(parsed.root);
  for (const i of issues) console.log(`             ${i.severity}: ${i.path}: ${i.message}   (in Godot's ${output})`);
  const bad = issues.some((i) => i.severity === "error");
  const godotOnly = parsed.unsupported.length ? ` Godot-only, not in any definition: ${parsed.unsupported.join("; ")}.` : "";

  if (pull) {
    const registry = existsSync(join(DEFS, "registry.gen.ts")) ? await import(pathToFileURL(join(DEFS, "registry.gen.ts")).href) : {};
    const next = emitTscn(parsed.root);
    if (parsed.unsupported.length === 0) {
      writeFileSync(join(DEFS, file), writeDef(parsed.root, { output, registry, header: [
        `Pulled from ${output} (the Godot editor's version) by \`npm run pull\`. TypeScript owns the scene again: edit this file.`,
      ] }));
      writeFileSync(resolve(ROOT, output), next);
      say("scenes", `${name}: pulled -> ${output}: ${file} rewritten from the scene; TypeScript owns it again (the scene was rewritten from it: Godot's unique_ids dropped, it adds new ones on its next save)`);
      return { changed: true, state: sha(next), failed: bad };
    }
    writeFileSync(join(DEFS, file), writeDef(parsed.root, { output, registry, header: [
      `Pulled from ${output} by \`npm run pull\` as a MIRROR: Godot owns that scene, and editing this file does not change it.`,
      `Godot-only, not in this file: ${parsed.unsupported.join("; ")}.`,
    ] }));
    say("scenes", `${name}: pulled ${file} from ${output} as a mirror; Godot keeps the scene, because the definition cannot hold it all.${godotOnly}`);
    return { state: { written: writtenOf(a.entry)!, def: sha(next) }, failed: bad };
  }

  const diffs = diffTrees(a.tree, parsed.root);
  const list = (d: string[]) => d.slice(0, 8).map((x) => `\n               ${x}`).join("") + (d.length > 8 ? `\n               ... and ${d.length - 8} more` : "");
  if (diffs.length === 0) {
    say("scenes", `${name}: owned by Godot; ${file} matches it.${godotOnly}`);
    return { failed: bad };
  }
  if (sha(a.text) !== defBaseOf(a.entry)) {
    say("scenes", `${name}: CONFLICT: ${file} changed, and so did ${output} in Godot. Differences (definition -> scene):${list(diffs)}` +
      `\n             Keep Godot's: npm run pull (rewrites ${file}). Keep TypeScript's: npm run build -- --force (rewrites the scene${parsed.unsupported.length ? `, losing: ${parsed.unsupported.join("; ")}` : ""}).`);
    return { failed: true };
  }
  say("scenes", `${name}: owned by Godot; ${file} is behind the scene (${diffs.length} difference${diffs.length > 1 ? "s" : ""}):${list(diffs)}` +
    `\n             To update the definition from the scene: npm run pull.${godotOnly}`);
  return { failed: bad };
}

async function buildScenes(): Promise<{ failed: boolean; changed: boolean }> {
  const files = existsSync(DEFS) ? readdirSync(DEFS).filter((f) => f.endsWith(".def.ts")).sort() : [];
  if (files.length === 0) { say("scenes", "no scene-defs/*.def.ts found"); return { failed: false, changed: false }; }
  // bun runs a definition without type-checking it: a mistyped registry key would reach the emitter as `undefined`
  const tsc = join(ROOT, "node_modules/.bin/tsc");
  if (existsSync(join(DEFS, "tsconfig.json")) && existsSync(tsc)) {
    const t = spawnSync(tsc, ["--noEmit", "--pretty", "false", "-p", DEFS], { cwd: ROOT, encoding: "utf8" });
    if (t.status !== 0) {
      const errors = (t.stdout + t.stderr).split("\n").filter((l) => /error TS/.test(l));
      for (const e of errors.slice(0, 10)) console.log(`             ${e}`);
      say("types", `scene-defs: ${errors.length} type error${errors.length === 1 ? "" : "s"}; no scene written`);
      return { failed: true, changed: false };
    }
    say("types", "scene-defs: ok");
  }
  const state: Record<string, StateEntry> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  let failed = false, changed = false;

  for (const file of files) {
    const name = file.replace(/\.def\.ts$/, "");
    try {
      const mod = await import(pathToFileURL(join(DEFS, file)).href);
      const tree = mod.default, output: unknown = mod.output;
      if (!tree || typeof output !== "string") throw new Error('needs `export default` (the scene) and `export const output = "scenes/x.tscn"`');

      const text = emitTscn(tree);
      const target = resolve(ROOT, output);
      const existing = existsSync(target) ? readFileSync(target, "utf8") : null;
      const decision = decideWrite({ existing, lastHash: writtenOf(state[output]), next: text, force });
      if (decision === "blocked-edited") {
        // scaffold once: a scene saved in Godot after we wrote it belongs to Godot from then on. Not an error.
        const r = await godotOwned({ name, file, output, tree, text, existing: existing!, entry: state[output] });
        if (r.state !== undefined) state[output] = r.state;
        if (r.failed) failed = true;
        if (r.changed) changed = true;
        continue;
      }
      if (pull) { say("scenes", `${name}: nothing to pull (${output} is not owned by Godot)`); }

      const issues = validate(tree);
      for (const i of issues) console.log(`             ${i.severity}: ${i.path}: ${i.message}`);
      if (issues.some((i) => i.severity === "error")) { say("scenes", `${name}: FAILED validation, nothing written`); failed = true; continue; }

      if (decision === "blocked-unknown") {
        say("scenes", `${name}: NOT WRITTEN: ${output} exists but this tool never wrote it. Pick another \`output\`, or rerun with --force to overwrite.`);
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
  const s = spawnSync(process.execPath, [SELF, "--scenes-only", ...(force ? ["--force"] : []), ...(pull ? ["--pull"] : [])], { cwd: ROOT, encoding: "utf8" });
  process.stdout.write(s.stdout);
  if (s.status !== 0) failed = true;
  const wrote = (what: string) => new RegExp(`: (${what})( \\(\\d+ warnings?\\))? ->`).test(s.stdout);
  const changed = wrote("create|overwrite|pulled");
  if (!failed && wrote("create")) {
    // a new scene file is a new registry entry
    const again = spawnSync(process.execPath, [REGISTRY_TOOL, ROOT, "--out", join(DEFS, "registry.gen.ts")], { cwd: ROOT, encoding: "utf8" });
    if (again.status !== 0) { say("registry", `again, for new scenes: FAILED`); failed = true; }
    else say("registry", `again, for new scenes: ${again.stdout.startsWith("unchanged") ? "unchanged" : "regenerated"}`);
  }
  if (hasTstogd && !failed && (changed || !firstConvertOk)) {
    const c = convert();
    for (const d of c.ok ? [] : c.details.slice(0, 10)) console.log(`             ${d}`);
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
