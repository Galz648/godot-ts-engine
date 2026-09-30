# What is left

Written 2026-09-30, at the end of the first phase. Read `STATUS.md` first for where things stand, `LIMITS.md` for the
catches, and `DECISIONS.md` for what was decided.

## What "complete for this phase" means

Done and checked (run `./check-all.sh` in this repo, and `npm run verify:breakout` / `npm run sim:breakout` in the game repo):

- Four tools exist and pass their own checks: registry, emitter, validator, editor plugin.
- One shared scene type; the validator and the emitter use it. The registry works by hand (`USING-THE-REGISTRY.md`).
- Two real scenes were generated and compared with Godot by independent checks: Pong (6 nodes) and Breakout (142 nodes,
  706 checks, played headless). The Pong proof found one real bug (`scriptProps`), fixed.
- The limits are written down in plain language.

**Not** claimed: that this is a pipeline you can use every day. The steps still have to be run by hand, in order.

## Decisions only you can make

| # | Question | Why it matters | Notes |
| --- | --- | --- | --- |
| 1 | Per scene: **generated** (only edited in TypeScript), **scaffold once** (then owned by the Godot editor), or **split**? | The emitter overwrites; editor edits are lost on the next emit. | `LIMITS.md` section 1. Split needs instancing, which does not exist yet. |
| 2 | Should registry keys **always include the folder** (`scriptsPongMain`) so they never change? | Adding `breakout/main.gd` renamed Pong's `Scripts.main` and broke its definition. | Breakout finding 1. Costs longer names everywhere. |
| 3 | ~~Keep the validator's `sprite-needs-texture` rule?~~ | **Kept** (2026-09-30): a warning, our rule, not Godot's. | See `DECISIONS.md`. |
| 4 | ~~The GodotJS to tstogd switch~~ | **No such migration exists** (user, 2026-09-30). Removed. | |
| 5 | ~~Rename the game repo~~ | **Done 2026-09-30:** `lightway-example` is now `godot-ts-playground` (GitHub redirects the old URL). | The local folder is still `lightway-example`; rename it with `mv` if you like. |

## Build next, in the order I would do it

**A. Finish the integration (held on purpose, to go slowly)**

1. **Registry hand-over into the scene type.** Today each game writes three lines of `Vocab` by hand and imports engine types by relative path into the submodule. Make that a proper import with a helper.
2. ~~Editor plugin on the real validator and the shared type~~ **Reworked 2026-09-30** (tolerant of helpers and loops; real validator). Seen working in the Cursor editor (2026-09-30). Still to do: the "feels no slower" check on a big scene file.
3. ~~A `build` command~~ **Done (minimal, 2026-09-30):** `packages/build`, see `DAILY-WORKFLOW.md`. Still to do for it: a `--only <scene>` option, and running the registry step only when files changed.
4. ~~Move the verifier into the engine~~ **Done 2026-09-30:** `packages/verify` (`verify.ts` checks every `scene-defs/*.def.ts`; on the playground: Breakout 706 checks, Pong 41, 0 problems; a changed prop and an extra node are caught). Still to do: point the playground's `verify:*` scripts at it and delete its copies in `scene-defs/verify/` (`sim-breakout.gd` stays, it is Breakout's).
5. **Game template** ~~(new)~~ **Done 2026-09-30:** `packages/create`. End-to-end check, as run: clone this repo to `/tmp`, commit the working tree there, then `bun <clone>/packages/create/src/create.ts my-game --engine-url <clone>`; then in the game `npm run check`, the editor plugin's `test/check-file.mjs`, and a headless run holding the right arrow (the square moves 174 px right, 0 down). Still to do: push, then try `npx github:Galz648/godot-ts-engine` from GitHub for real; tag a release so games can pin it; GitHub Actions for new games (left out on purpose).

**B. Emitter features Breakout needed and could not have** (each one is a worked-around gap, not a guess)

- Share one resource between nodes (40 identical brick shapes became 40 resources).
- Groups, signal connections (`[connection]`), instanced scenes, `uid://` references.
- ~~An overwrite guard~~ **Done** (in `packages/build`, not in the emitter itself): a scene changed since the tool wrote it is not overwritten without `--force`.

**C. Validator**

- **Check that script and texture paths exist** (today only the typed vocabulary catches a wrong path; an untyped tree passes). A version of this was built on the shelved `layer2-validation` branch.
- **The `extends` check** (decided yes, later): read the script's `extends X`, require the node type to be X or a descendant. Skip paths and `class_name`s. Needs Godot's exact message for a mismatch confirmed first.
- Check script variable names (`scriptProps` keys are unchecked; TypeScript does not check spread keys).
- More of Godot's own warnings, one at a time, each confirmed against the editor.
- A one-line command to regenerate the class data for another Godot version.

**D. Registry**

- More file kinds (audio, fonts, other resources). Today: textures, scenes, scripts.

## Never checked, anywhere

- **Windows** and **Linux** (paths are normalised in code; nothing was run). Godot versions other than 4.7.2.
- A generated scene **opened in the Godot editor** (Pong and Breakout were loaded through Godot's loader, not opened).
- **Adding a new node in the editor** and then re-emitting (only moving a node and saving was tested).
- The editor plugin: the "feels no slower" half of the speed check on a big scene file, and TypeScript versions other than 5.9.3.
- Whether the 253-member node-class union slows the editor on big scene files.
- Emitter speed on large scenes (never timed).
- Scenes using animation, audio, tile maps, themes, or many signals.

## Housekeeping (on your machine / accounts)

- Two throwaway Cursor profiles exist: `~/.cc-poc4` (delete it) and `~/.cc-lightway` (made by `tools/cursor-profile/launch.sh`; keep if you use that launcher).
- The shelved branch `layer2-validation` in the game repo holds an earlier validation attempt; delete it or keep it as reference.
- The original handover and overview documents are in `docs/pocs/`.

## Picking this up

    git clone --recurse-submodules https://github.com/Galz648/godot-ts-playground   # the game repo, engine/ included
    cd engine && ./check-all.sh          # after `bun install` in each package under packages/
    cd .. && npm install && npm run scenes:breakout && npm run verify:breakout && npm run sim:breakout
