# The day-to-day loop

The smallest workflow that is useful, built on `packages/build`. Everything here was run on the game repo.

## The loop

1. Write or edit TypeScript: game scripts in `src/` (compiled by tstogd), scenes in `scene-defs/*.def.ts`.
2. Run **one command**: `npm run build` (or `npm run dev` to keep it running).
3. Open Godot. The scenes are there and the scripts are compiled.

## What `npm run build` does

| Step | What | Stops the build when |
| --- | --- | --- |
| convert | `tstogd convert`: TypeScript scripts to GDScript and typings | never on its own; it is reported, and checked again at the end if a scene changed |
| registry | regenerates `scene-defs/registry.gen.ts` (every script, scene and texture path, as types) | the tool fails |
| scenes | for each `scene-defs/*.def.ts`: **validate**, then write the scene file | a validation **error** (warnings are printed, not blocking), or a definition that cannot load, or the guard (below) |
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
| **was changed since** (edited in Godot) | **refuses**: `NOT WRITTEN: ... was changed after this tool wrote it (edited in Godot?). Move your edits into pong.def.ts, or rerun with --force` |
| exists but the build never wrote it (for example a hand-made scene) | **refuses**, same idea |

`--force` overwrites anyway. Tested with a simulated Godot edit and with a hand-made scene: both refused, both files untouched.
This does not merge anything. It only stops you losing work silently; `LIMITS.md` section 1 still applies.

## Watch mode

`npm run dev` runs a full build once, then keeps `tstogd watch` and the registry in watch mode and rebuilds the scenes when a
`*.def.ts` file changes (measured: the scene file was rewritten 0.59 s after saving). Ctrl-C stops it and its helpers.

## What it does not do

- It does not run or import into Godot. A brand-new texture still needs the editor (or `godot --headless --import`) to import it once.
- It does not watch the game scripts itself; `tstogd watch` does that.
- The editor squiggle plugin is separate and still held (`STATUS.md`).
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
