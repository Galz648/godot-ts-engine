#!/usr/bin/env bun
// Starts a new Godot + TypeScript game from the template next to this file, with this engine mounted at engine/.
//
//   npx github:Galz648/godot-ts-engine my-game [options]         (or: bun packages/create/src/create.ts my-game)
//
//   --name "My Game"      display name (default: the folder name)
//   --engine-url <url>    where the engine submodule is cloned from (default: this checkout's origin, else GitHub)
//   --engine-ref <ref>    tag, branch or commit to pin (default: this checkout's commit, else main)
//   --no-install          stop after git: no npm install, editor plugin, build, Godot import or verify
//   --files-only          only write the template files (no git, no engine, no install)
//
// Steps: files, git init, engine submodule at the pinned commit, npm install, editor plugin build, first build,
// Godot import, verify, smoke test, first commit. Every step says what it did; a failed step stops with the command to retry.

import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, "../template");
const ENGINE_ROOT = resolve(HERE, "../../..");
const DEFAULT_URL = "https://github.com/Galz648/godot-ts-engine.git";
const RENAMES: Record<string, string> = { gitignore: ".gitignore" }; // npm drops .gitignore files when packing

type Options = { dir: string; name: string; engineUrl?: string; engineRef?: string; install: boolean; filesOnly: boolean };

export function parseArgs(argv: string[]): Options {
  const opts: Partial<Options> & { install: boolean; filesOnly: boolean } = { install: true, filesOnly: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const value = () => { const v = argv[++i]; if (!v) throw new Error(`${a} needs a value`); return v; };
    if (a === "--name") opts.name = value();
    else if (a === "--engine-url") opts.engineUrl = value();
    else if (a === "--engine-ref") opts.engineRef = value();
    else if (a === "--no-install") opts.install = false;
    else if (a === "--files-only") opts.filesOnly = true;
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else rest.push(a);
  }
  if (rest.length !== 1) throw new Error("usage: create <folder> [--name \"My Game\"] [--engine-url <url>] [--engine-ref <ref>] [--no-install] [--files-only]");
  const dir = resolve(rest[0]!);
  const name = opts.name ?? basename(dir);
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(name)) throw new Error(`name "${name}": use letters, digits, spaces, "-" and "_" (start with a letter or digit)`);
  return { ...opts, dir, name } as Options;
}

export const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Copies the template into `dir`, filling in {{name}} and {{slug}}. Returns the files written, relative to `dir`. */
export function writeTemplate(dir: string, name: string): string[] {
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new Error(`${dir} exists and is not empty`);
  const vars: Record<string, string> = { name, slug: slugOf(name) };
  const written: string[] = [];
  const copy = (from: string, to: string) => {
    for (const entry of readdirSync(from)) {
      const src = join(from, entry), dst = join(to, RENAMES[entry] ?? entry);
      if (statSync(src).isDirectory()) { copy(src, dst); continue; }
      mkdirSync(to, { recursive: true });
      writeFileSync(dst, readFileSync(src, "utf8").replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m));
      if (statSync(src).mode & 0o111) chmodSync(dst, 0o755);
      written.push(relative(dir, dst));
    }
  };
  copy(TEMPLATE, dir);
  return written.sort();
}

// ---- the rest needs git, npm, bun and (optionally) godot -------------------------------------------------

const say = (step: string, text: string) => console.log(`${step.padEnd(10)} ${text}`);

function run(cmd: string, args: string[], opts: SpawnSyncOptions & { quiet?: boolean } = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: opts.quiet ? "pipe" : "inherit", ...opts });
  if (r.status !== 0) {
    const out = opts.quiet ? `\n${String(r.stdout ?? "")}${String(r.stderr ?? "")}`.trimEnd() : "";
    throw new Error(`failed: ${cmd} ${args.join(" ")}${opts.cwd ? `  (in ${opts.cwd})` : ""}${out}`);
  }
  return String(r.stdout ?? "").trim();
}
const has = (cmd: string) => spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0;
const git = (cwd: string, ...args: string[]) => run("git", args, { cwd, quiet: true });

/** Where the engine comes from, and which commit. Defaults to exactly the engine this template came from. */
function engineSource(opts: Options): { url: string; ref: string; local: boolean } {
  const isCheckout = spawnSync("git", ["-C", ENGINE_ROOT, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout?.trim() === ENGINE_ROOT;
  let url = opts.engineUrl, ref = opts.engineRef;
  if (isCheckout) {
    url ??= spawnSync("git", ["-C", ENGINE_ROOT, "remote", "get-url", "origin"], { encoding: "utf8" }).stdout?.trim() || DEFAULT_URL;
    if (!ref) {
      ref = git(ENGINE_ROOT, "rev-parse", "HEAD");
      const dirty = git(ENGINE_ROOT, "status", "--porcelain");
      if (dirty) say("engine", `note: ${ENGINE_ROOT} has uncommitted changes; the game gets the committed engine, and the template as it is on disk`);
      const onRemote = !!spawnSync("git", ["-C", ENGINE_ROOT, "branch", "-r", "--contains", ref], { encoding: "utf8" }).stdout?.trim();
      const urlIsLocal = existsSync(url);
      if (!onRemote && !urlIsLocal) throw new Error(`this engine checkout's commit ${ref.slice(0, 7)} is not pushed, so ${url} cannot provide it. Push it, or pass --engine-ref <tag|branch>.`);
    }
  }
  url ??= DEFAULT_URL;
  ref ??= "main";
  return { url, ref, local: existsSync(url) };
}

function create(opts: Options) {
  const files = writeTemplate(opts.dir, opts.name);
  say("files", `${files.length} files in ${opts.dir}`);
  if (opts.filesOnly) return;

  const dir = opts.dir;
  try {
    const src = engineSource(opts);
    git(dir, "init", "-q", "-b", "main");
    const allowFile = src.local ? ["-c", "protocol.file.allow=always"] : [];
    run("git", [...allowFile, "submodule", "add", "-q", src.url, "engine"], { cwd: dir, quiet: true });
    git(join(dir, "engine"), "checkout", "-q", src.ref);
    const pinned = git(join(dir, "engine"), "rev-parse", "HEAD");
    const tag = spawnSync("git", ["-C", join(dir, "engine"), "describe", "--tags", "--exact-match"], { encoding: "utf8" }).stdout?.trim();
    say("engine", `${src.url} at ${pinned.slice(0, 7)}${tag ? ` (${tag})` : ""}`);
    for (const pkg of ["build/src/build.ts", "verify/src/verify.ts", "scene-sync/src/write-def.ts"]) {
      if (!existsSync(join(dir, "engine/packages", pkg))) throw new Error(`the pinned engine has no packages/${pkg}; it is older than this template. Pass a newer --engine-ref.`);
    }
  } catch (err) {
    rmSync(dir, { recursive: true, force: true }); // it was empty or missing before (writeTemplate checks), so nothing of yours is lost
    say("cleanup", `removed ${dir}`);
    throw err;
  }

  if (opts.install) {
    for (const tool of ["npm", "bun"]) if (!has(tool)) throw new Error(`${tool} is not on PATH`);
    run("npm", ["install", "--no-fund", "--no-audit", "--loglevel=error"], { cwd: dir });
    say("install", "npm packages");
    const plugin = join(dir, "engine/packages/lint-plugin");
    run("bun", ["install"], { cwd: plugin, quiet: true });
    run("bun", ["run", "build"], { cwd: plugin, quiet: true });
    say("editor", "scene-lint plugin built");
    const godot = process.env.GODOT ?? "godot";
    if (has(godot)) {
      // tstogd checks each .gd with Godot, which only knows a script's class_name (main.ts uses Coin) once the project is
      // imported, and the import needs the .gd files. So a first build that may fail on that, the import, then the real one.
      spawnSync("npm", ["run", "--silent", "build"], { cwd: dir, encoding: "utf8" });
      run(godot, ["--headless", "--path", dir, "--import"], { cwd: dir, quiet: true });
      // tstogd only rewrites the typings of scripts it sees change; they should list the uids the import just made
      const now = new Date();
      for (const f of readdirSync(join(dir, "src"), { recursive: true }) as string[]) {
        if (f.endsWith(".ts") && !f.startsWith("_typings")) utimesSync(join(dir, "src", f), now, now);
      }
    }
    run("npm", ["run", "--silent", "build"], { cwd: dir });
    if (has(godot)) {
      run(godot, ["--headless", "--path", dir, "--import"], { cwd: dir, quiet: true });
      say("godot", "project imported (class names cached, textures imported)");
      run("npm", ["run", "--silent", "verify"], { cwd: dir });
      run("npm", ["run", "--silent", "smoke"], { cwd: dir });
    } else say("godot", `not on PATH: skipped import, verify and smoke. Later: godot --headless --import && npm run verify && npm run smoke`);
  }

  git(dir, "add", "-A");
  const commit = spawnSync("git", ["commit", "-q", "-m", `Start ${opts.name} from the godot-ts-engine template`], { cwd: dir, encoding: "utf8" });
  say("git", commit.status === 0 ? "first commit made" : `files staged, not committed (${(commit.stderr || commit.stdout).trim().split("\n")[0]})`);

  console.log(`\n${opts.name} is ready in ${dir}\n`);
  console.log(`  cd ${relative(process.cwd(), dir) || "."}`);
  if (!opts.install) console.log("  npm install && npm run setup:editor && npm run build");
  console.log("  godot -e                        # open it in Godot, F5 to run");
  console.log("  tools/cursor-profile/launch.sh  # open it in Cursor with scene squiggles");
  console.log("  npm run dev                     # rebuild on every save");
}

if (import.meta.main) {
  try {
    create(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(`create: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
