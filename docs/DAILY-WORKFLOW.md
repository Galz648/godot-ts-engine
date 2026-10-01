# How to work with this (the day-to-day loop)

## Bottom line (2026-10-02)

Start a game with one command, write scripts in TypeScript, and optionally scaffold a new scene in TypeScript. Once you save
that scene in Godot, Godot owns it: the build stops writing it, but still reads it back, checks it and tells you whether the
definition matches, is behind, or conflicts. `npm run pull` brings Godot's version back into the definition ("scaffold once,
with pull", `DECISIONS.md`).

**What works**

- **New game:** `npx github:Galz648/godot-ts-engine#v0.1.5 my-game --name "My Game" --engine-ref v0.1.5` gives a runnable
  Godot project: collect-the-coin (two SVG textures, a body and an area with shapes, an exported variable set from the
  definition, a custom signal), this engine pinned at `engine/`, a first build, `verify` and a headless smoke test that pass,
  and a first commit. The game's README has a "Try breaking it" table: eleven mistakes and the message that catches each.
  (Games started from `v0.1.0` or `v0.1.1` lack pull and the drift notice: update their `engine/` to `v0.1.5`; optionally add
  `"pull": "bun engine/packages/build/src/build.ts --pull"` to `package.json`.)
- **Scripts:** TypeScript in `src/scripts/`, compiled to GDScript by tstogd. The whole Godot API is typed, and so are your
  scenes' nodes, `res://` paths, groups and signals (tstogd generates those typings from the project).
- **Scenes, optionally:** scaffolded from `scene-defs/*.def.ts`. Checked with readable errors, written as `.tscn`, with typed
  script and texture paths from the registry.
- **Checks:** `npm run build` compiles, checks and writes; `npm run verify` loads each generated scene in headless Godot and
  compares it with its definition; squiggles while you type, from the game's `.vscode/settings.json` and `scene-lint` dev dependency.

**The workflow**

1. **Start a game** with the `npx` command above.
2. **Write game logic** in `src/scripts/*.ts`, with `npm run dev` running (it rebuilds on every save).
3. **A new scene**, one of two ways:
   - **In TypeScript**, when code beats clicking (a grid, 100 bricks, a layout): write `scene-defs/level.def.ts`, iterate with
     `npm run build` and look at it in Godot. When it is right, carry on in Godot if you like: the build then reports how
     the definition and the scene compare (below), and `npm run pull` updates the definition from the scene.
   - **In Godot**, for everything else: make it in the editor as usual.
4. **Wire things up in scripts**, not in definitions: signals (`this.button.pressed.connect(this.on_press)`), groups
   (`add_to_group`), spawning (`preload("res://x.tscn").instantiate()`). The editor works too, with one rule: write a
   signal's handler in TypeScript first, because the editor puts its stub in the generated `.gd`, which tstogd overwrites.
5. **Press F5** in Godot to play. Run `npm run verify` and `npm run smoke` before committing.

**What does not work**

- Groups, signal connections, instanced scenes or shared resources inside a definition (use step 4). A scene that has them
  can be pulled only as a mirror (below).
- Merging: when both sides changed, you pick one (`npm run pull` or `--force`); the build does not combine them.
- Windows for the generator, and continuous integration (neither exists).

The rest of this page is the detail: what each step of `npm run build` does, the overwrite guard, watch mode, squiggles.

## The loop

1. Write or edit TypeScript: game scripts in `src/` (compiled by tstogd), new scenes in `scene-defs/*.def.ts`.
2. Run **one command**: `npm run build` (or `npm run dev` to keep it running).
3. Open Godot. The scenes are there and the scripts are compiled.

**Scenes are scaffolded once** (decided 2026-10-01, `DECISIONS.md`). Iterate on a definition as long as you like; the build
rewrites its scene each time. The first time you save that scene in the Godot editor, Godot owns it: the build no longer
writes it and `npm run verify` skips it, and the build compares it with the definition instead (next section). Scripts stay
in TypeScript throughout.

## When a scene is saved in Godot (drift, conflict, pull)

The build reads Godot's version back (`packages/scene-sync`), runs the validator on it (errors fail the build; the message
says `(in Godot's scenes/main.tscn)`), and compares it with what the definition would write:

| The build says | When | Exit |
| --- | --- | --- |
| `owned by Godot; main.def.ts matches it.` | same tree | 0 |
| `main.def.ts is behind the scene (N differences):` then the list, then `To update the definition from the scene: npm run pull.` | the scene changed, the definition did not | 0 |
| `CONFLICT: main.def.ts changed, and so did scenes/main.tscn in Godot.` then the list, then both ways out | both changed | 1 |

The list reads like `Coin: position Vector2(760, 324) -> Vector2(900, 200)`, `Coin: script variable value 7 -> 5`,
`+ Spawner (Timer)`, `- Hud/Hint` (at most 8 lines, then "and N more"). Anything the definition cannot hold is named:
`Godot-only, not in any definition: node Coin: attribute "groups" (groups not modelled).`

`npm run pull` (`build.ts --pull`) rewrites the definition from the scene (`packages/scene-sync/src/write-def.ts`): paths the
registry knows become `Scripts.x` / `Textures.y`, others stay strings (and so fail the type check), and helpers such as `vec()`
or loops become one literal tree. Then, **hybrid ownership**:

- The scene holds nothing the definition cannot (no groups, editor connections, instances, other resources): **TypeScript
  owns it again**. The scene is rewritten from the new definition (Godot's `unique_id`s go; it adds new ones on its next
  save), and you edit the `.def.ts` from then on.
- Otherwise: **Godot keeps it**, and the definition is a **mirror**. Its header says `MIRROR` and lists what is missing. The
  build reports "matches" while you leave it alone; if you edit it, that is a conflict (with `--force` saying what it would lose).

`--pull` and `--force` together are refused. For a mirror, `.emitted.json` stores `{ "written": <hash of what the build last
wrote>, "def": <hash of what the pulled definition writes> }`, so the build can tell "you edited the mirror" from "untouched".

Tested on a generated game, with Godot's own scene writer (`ResourceSaver`, the editor's path) moving the coin and adding a
Timer: behind (exit 0), then a definition edit giving a conflict (exit 1), then pull (TypeScript owns it; `verify` and the
smoke test pass after the next definition edit); and the same with a group added: pull gives a mirror, the next build says
"matches", `verify` skips it, editing the mirror is a conflict.

## What `npm run build` does

| Step | What | Stops the build when |
| --- | --- | --- |
| convert | `tstogd convert`: TypeScript scripts to GDScript and typings | never on its own; it is reported, and checked again at the end if a scene changed |
| registry | regenerates `scene-defs/registry.gen.ts` (every script, scene and texture path, as types) | the tool fails |
| types | `tsc --noEmit -p scene-defs` (if the game has `scene-defs/tsconfig.json` and TypeScript installed): a mistyped registry key, or a texture whose file is gone | any type error; no scene is written |
| scenes | for each `scene-defs/*.def.ts`: **validate** (the validator's rules, plus `props` / `scriptProps` checked against each node's generated `.gd`), then write the scene file; for a scene saved in Godot, compare instead (above) | a validation **error** (warnings are printed, not blocking), a definition that cannot load, a conflict, or the guard (below) |
| registry again | only if a scene was created, so the new scene is listed | the tool fails |
| convert again | only if a scene changed, so scripts see the new scene's typings | tstogd reports errors |

tstogd writes a scene's typings during a convert but type-checks the scripts against the typings it started with. So a
convert that changed the typings is run again (at most twice more), and a script broken by a scene change fails in the
same build, not the next one.

Exit code 0 means everything passed, so it can be used in a script or CI. A typical run takes about 3 to 5 seconds.

## A scene definition

```ts
import type { SceneNode } from "../engine/packages/scene/src/index.ts";
// ... the scene tree, typed with the registry's paths (see USING-THE-REGISTRY.md) ...
export default scene;                                  // the tree
export const output = "scenes/pong/main.generated.tscn"; // where the scene file goes
```

## The overwrite guard (why your Godot edits are safe)

The emitter writes a whole scene from the TypeScript, so anything you changed in the Godot editor would be lost. The build
keeps a hash of each file it wrote in `scene-defs/.emitted.json` (commit this file). Before overwriting it checks:

| The scene file on disk | The build |
| --- | --- |
| does not exist | creates it |
| is exactly what the build wrote last time | overwrites it (your TypeScript changed) |
| already equals the new output | leaves it alone |
| **was changed since** (saved in Godot) | **does not write it**; compares it with the definition: matches, behind or conflict (above). `verify` skips it |
| exists but the build never wrote it (for example a hand-made scene) | **refuses and fails**: the definition's `output` points at someone else's file |

`--force` overwrites anyway (TypeScript's version wins); `--pull` rewrites the definition instead (Godot's wins). Nothing is merged.

## Watch mode

`npm run dev` runs a full build once, then keeps `tstogd watch` and the registry in watch mode and rebuilds the scenes when a
`*.def.ts` file or the registry changes (a file added or removed, or the viewport size changed in `project.godot`) (measured: the scene file was rewritten 0.59 s after saving). It also watches the scenes the build
wrote: when one changes and is no longer what the build wrote (its own writes match and are ignored), it prints
`scenes/main.tscn saved outside the build (Godot?)` and the comparison (matches, behind, conflict). Tested with a Godot save
while `npm run dev` ran: reported about a second later; a definition edit just before it gave no false report. Ctrl-C stops
it and its helpers.

## What it does not do

- It does not run or import into Godot. A brand-new texture still needs the editor (or `godot --headless --import`) to import it once.
- It does not watch the game scripts itself; `tstogd watch` does that.
- It does not merge editor changes with definition changes: it reports them, and `--pull` or `--force` picks a side.
- `--watch` never pulls. It does report a save in Godot (below), but only for scenes the build wrote.
- Not tested: Windows; definitions that load slowly; more than a few scenes.

## Optional: live squiggles in the editor

The plugin in `packages/lint-plugin` shows the validator's findings as squiggles while you type in a `scene-defs/*.def.ts`
file. It is live feedback only; `npm run build` is what checks the whole tree. One-time setup in the game repo:

1. Build the plugin: `cd engine/packages/lint-plugin && bun install && bun run build`.
2. `scene-defs/tsconfig.json` lists it: `"plugins": [{ "name": "scene-lint" }]` (already done in the game repo).
3. The editor must use the project's TypeScript 5.9 with TypeScript 7 off, and find the plugin. The game's `.vscode/settings.json`
   turns TypeScript 7 off and points at `node_modules/typescript`; the `scene-lint` dev dependency (`file:engine/packages/lint-plugin/plugins/scene-lint`)
   puts the plugin where that TypeScript finds it. Cursor did not offer the prompt on its own: open a `.def.ts`, click the TypeScript version in the status bar and pick **Use Workspace Version** (once per folder).
   (`typescript.tsserver.pluginPaths` does not work here: VS Code ignores it in workspace settings.)

What it sees: the literal parts of a definition. Nodes made by helper functions, loops or spreads are opaque to it (see `LIMITS.md`).
To see exactly what the editor would show without an editor: `node engine/packages/lint-plugin/test/check-file.mjs scene-defs scene-defs/pong.def.ts`.
