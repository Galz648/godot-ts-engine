# How to work with this (the day-to-day loop)

## Bottom line (2026-10-01)

Start a game with one command, write scripts in TypeScript, and optionally scaffold a new scene in TypeScript. Once you save
that scene in Godot, Godot owns it and these tools stop touching it ("scaffold once", `DECISIONS.md`).

**What works**

- **New game:** `npx github:Galz648/godot-ts-engine#v0.1.1 my-game --name "My Game" --engine-ref v0.1.1` gives a runnable
  Godot project: a movable square, this engine pinned at `engine/`, a first build that passes, and a first commit.
  (Games started from `v0.1.0` lack the Godot handover below: update their `engine/` to `v0.1.1`.)
- **Scripts:** TypeScript in `src/scripts/`, compiled to GDScript by tstogd. The whole Godot API is typed, and so are your
  scenes' nodes, `res://` paths, groups and signals (tstogd generates those typings from the project).
- **Scenes, optionally:** scaffolded from `scene-defs/*.def.ts`. Checked with readable errors, written as `.tscn`, with typed
  script and texture paths from the registry.
- **Checks:** `npm run build` compiles, checks and writes; `npm run verify` loads each generated scene in headless Godot and
  compares it with its definition; squiggles while you type, through `tools/cursor-profile/launch.sh`.

**The workflow**

1. **Start a game** with the `npx` command above.
2. **Write game logic** in `src/scripts/*.ts`, with `npm run dev` running (it rebuilds on every save).
3. **A new scene**, one of two ways:
   - **In TypeScript**, when code beats clicking (a grid, 100 bricks, a layout): write `scene-defs/level.def.ts`, iterate with
     `npm run build` and look at it in Godot. When it is right, save it in Godot. From then on the build prints
     `owned by Godot; skipped`, which is normal. Delete the `.def.ts` whenever you like.
   - **In Godot**, for everything else: make it in the editor as usual.
4. **Wire things up in scripts**, not in definitions: signals (`this.button.pressed.connect(this.on_press)`), groups
   (`add_to_group`), spawning (`preload("res://x.tscn").instantiate()`). The editor works too, with one rule: write a
   signal's handler in TypeScript first, because the editor puts its stub in the generated `.gd`, which tstogd overwrites.
5. **Press F5** in Godot to play. Run `npm run verify` before committing.

**What does not work**

- Bringing Godot edits back into a definition (the sync prototype is frozen).
- Groups, signal connections, instanced scenes or shared resources inside a definition (frozen; use step 4).
- Windows for the generator, and continuous integration (neither exists).

The rest of this page is the detail: what each step of `npm run build` does, the overwrite guard, watch mode, squiggles.

## The loop

1. Write or edit TypeScript: game scripts in `src/` (compiled by tstogd), new scenes in `scene-defs/*.def.ts`.
2. Run **one command**: `npm run build` (or `npm run dev` to keep it running).
3. Open Godot. The scenes are there and the scripts are compiled.

**Scenes are scaffolded once** (decided 2026-10-01, `DECISIONS.md`). Iterate on a definition as long as you like; the build
rewrites its scene each time. The first time you save that scene in the Godot editor, Godot owns it: from then on the build and
`npm run verify` skip it and say so. Delete the `.def.ts` when you no longer need it. Scripts stay in TypeScript throughout.

## What `npm run build` does

| Step | What | Stops the build when |
| --- | --- | --- |
| convert | `tstogd convert`: TypeScript scripts to GDScript and typings | never on its own; it is reported, and checked again at the end if a scene changed |
| registry | regenerates `scene-defs/registry.gen.ts` (every script, scene and texture path, as types) | the tool fails |
| scenes | for each `scene-defs/*.def.ts`: **validate**, then write the scene file | a validation **error** (warnings are printed, not blocking), or a definition that cannot load, or the guard (below) |
| registry again | only if a scene was created, so the new scene is listed | the tool fails |
| convert again | only if a scene changed, so scripts see the new scene's typings | tstogd reports errors |

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
| **was changed since** (saved in Godot) | **skips it, not an error**: `owned by Godot (saved there since this tool wrote ...); skipped. Delete main.def.ts when you are done with it, or --force to regenerate.` `verify` skips it too |
| exists but the build never wrote it (for example a hand-made scene) | **refuses and fails**: the definition's `output` points at someone else's file |

`--force` overwrites anyway. Tested with a real Godot save (Godot's own scene writer) on a generated game: the build skipped
the scene and exited 0, `verify` skipped it, `--force` regenerated it and `verify` passed again. Nothing is merged.

## Watch mode

`npm run dev` runs a full build once, then keeps `tstogd watch` and the registry in watch mode and rebuilds the scenes when a
`*.def.ts` file changes (measured: the scene file was rewritten 0.59 s after saving). Ctrl-C stops it and its helpers.

## What it does not do

- It does not run or import into Godot. A brand-new texture still needs the editor (or `godot --headless --import`) to import it once.
- It does not watch the game scripts itself; `tstogd watch` does that.
- It does not bring editor changes back into TypeScript (scaffold once; the sync prototype is frozen).
- Not tested: Windows; definitions that load slowly; more than a few scenes.

## Optional: live squiggles in the editor

The plugin in `packages/lint-plugin` shows the validator's findings as squiggles while you type in a `scene-defs/*.def.ts`
file. It is live feedback only; `npm run build` is what checks the whole tree. One-time setup in the game repo:

1. Build the plugin: `cd engine/packages/lint-plugin && bun install && bun run build`.
2. `scene-defs/tsconfig.json` lists it: `"plugins": [{ "name": "scene-lint" }]` (already done in the game repo).
3. The editor must use the project's TypeScript 5.9 with TypeScript 7 off, and know where the plugin is. The Cursor profile does both:
   `tools/cursor-profile/launch.sh` (it sets `typescript.tsserver.pluginPaths` to `engine/packages/lint-plugin` and turns TypeScript 7 off).
   Accept the prompt to use the workspace TypeScript version.

What it sees: the literal parts of a definition. Nodes made by helper functions, loops or spreads are opaque to it (see `LIMITS.md`).
To see exactly what the editor would show without an editor: `node engine/packages/lint-plugin/test/check-file.mjs scene-defs scene-defs/pong.def.ts`.
