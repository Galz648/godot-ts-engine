# Decisions after the four PoCs

Date: 2026-09-30. Answers to the open questions in the overview, plus decisions taken along the way.
Who decided is marked on each line.

## Open questions from the overview

1. **Switch the game from GodotJS to tstogd, or keep both side by side?**
   **Corrected by the user, 2026-09-30: there is no GodotJS migration.** This project uses tstogd only. The answer below is withdrawn.
   Decided by the user: **yes**. The question was phrased as "switch or keep both", and the answer was a bare "yes", so this is
   recorded as "switch to tstogd". If "keep both for now" was meant, correct this line.

2. **Should the validator also check a script's `extends` against its node type?**
   Decided by the agent (the user said "make that decision and record it"): **yes, but later, as a follow-up to the class-hierarchy work.**
   - Why: a script that does not extend its node's class is a real Godot failure that TypeScript cannot see, and the
     extracted class hierarchy (see below) makes the check cheap: read the script's `extends X` line and require
     `nodeType` to be X or a descendant of X.
   - Shape: an error-level rule. Skip (do not guess) when `extends` is a file path or a user `class_name`, which the Godot API does not know.
   - Where it runs: after tstogd has compiled the script, since it needs the `.gd` file. It belongs in the validator step
     of the pipeline, not in the editor plugin.
   - Unverified: the exact message Godot prints when a mismatched script is attached. To be confirmed when this is built.
   - Not part of the PoCs; nothing implemented yet.

3. **Where do these tools live?**
   Decided by the user: in **a separate engine-layer repo, used by the game repo as a submodule**. Done on 2026-09-30: this repo
   (`godot-ts-engine`) holds the four tools under `packages/`, with their git history; the game repo mounts it at `engine/`.

## Decisions made along the way

- **Class hierarchy for the validator and for editor types** (agent, the user asked for the fix and said they did not know what to do about the weak typing):
  generate a small data file from `godot --headless --dump-extension-api` (class name, parent, instantiable) and use it in two places:
  the validator's rules use `isA(type, ancestor)` instead of a hardcoded list (fixes the AnimatableBody2D false alarm and miss and
  catches class-name typos), and a generated `NodeType` union of string literals types `SceneNode.type` so a typo is an
  ordinary TypeScript error in the editor. This follows the overview's principle: types only for cheap literal unions, everything
  else as plain code. In progress in `poc3-validator` (see its `SESSION.md`, "Class hierarchy follow-up").
- **The validator's `sprite-needs-texture` rule is kept** (2026-09-30, milestone 1). Godot shows no warning for a `Sprite2D` without a
  texture, so this rule is a project rule, not a Godot rule. It stays a warning, fires on neither real scene, and its message says
  "unless a script sets one".
- **Cursor setup for other people** (user): a separate, small profile in `tools/cursor-profile/`: four TypeScript settings and three
  TypeScript extensions only. No keybindings, no personal settings, no machine paths. `launch.sh` runs it beside the normal Cursor.
  The profile forces TypeScript 7 off because it disables every tsserver plugin, which the scene-lint plugin needs.

## Scope: scaffold once (user, 2026-10-01)

- **Scene policy: scaffold once.** A scene definition writes its `.tscn`, and the build keeps rewriting it only while the file is
  exactly what the build last wrote. Once the scene is saved in the Godot editor, Godot owns it: the build and `verify` skip it
  and say so (not an error); `--force` regenerates. No merging, no syncing editor changes back. Why: the measurements in
  `MILESTONE-1.md` show every editor save adds things the model cannot hold, so fighting the editor is not worth it now.
- **Kept and worked on:** the registry (typed paths for scene definitions), the emitter and validator as the scaffold step,
  `verify`, the game template, and the editor squiggles. The squiggles cost nothing extra: tstogd's own editor plugin needs the
  same TypeScript 5.9 setup with TypeScript 7 off.
- **Frozen (kept in the repo, not worked on):** the merge and analyzer in `packages/scene-sync`, and new emitter features
  (groups, signal connections, instanced scenes, shared resources). Do those in scripts (tstogd) or in the editor.

## Pull: definitions from scenes (user, 2026-10-02)

- **Read-back unfrozen for one job:** the build reads a scene saved in Godot back (`parse.ts`), validates it, and compares it
  with the definition (`diff.ts`): "matches", "behind" (exit 0) or "CONFLICT" (exit 1). The merge stays frozen.
- **Regenerating is a flag, never automatic:** `npm run pull` (`build.ts --pull`) rewrites the definition from the scene
  (`write-def.ts`). A plain build only reports. `--pull` with `--force` is refused.
- **Ownership after a pull: hybrid.** If the scene holds nothing the definition cannot (no groups, editor connections,
  instances, other resources), TypeScript owns it again and the build rewrites the scene from the new definition. Otherwise
  Godot keeps it and the definition is a mirror, labelled as such; editing it is reported as a conflict.
- **Template: collect-the-coin**, chosen to exercise what the layer checks: textures through the registry, bodies and areas
  with shapes, an exported variable set from the definition, a custom signal connected in code, and a headless smoke test.

## Integration pace

- **Go slowly; integrate only the layers that fit together cleanly, and document where we are** (user, 2026-09-30).
  In practice: the shared scene type, the validator and the emitter are joined (layers 1-3). The registry, the editor
  plugin, a `build` command and the Pong proof are held on purpose. See `STATUS.md` for the table and the reasons.

## Status

| Item | State |
| --- | --- |
| GodotJS to tstogd | withdrawn: no such migration exists, tstogd only |
| `extends` check | decided, not built |
| Separate engine repo as a submodule | done: `godot-ts-engine`, mounted in the game repo as `engine/` |
| Class hierarchy in the validator and types | done (validator 40 tests; class data from Godot 4.7.2) |
| Shared `SceneNode` type | done (`packages/scene`), used by the validator and the emitter |
| Cursor profile | done, in `tools/cursor-profile/` |
| Scene policy | decided 2026-10-01: scaffold once; the build does not write scenes saved in Godot and `verify` skips them |
| Drift notice, conflict, pull | done 2026-10-02 (flag only, hybrid ownership) |
| Merge, new emitter features | frozen 2026-10-01 |
