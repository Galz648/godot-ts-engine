# Decisions after the four PoCs

Date: 2026-09-30. Answers to the open questions in the overview, plus decisions taken along the way.
Who decided is marked on each line.

## Open questions from the overview

1. **Switch the game from GodotJS to tstogd, or keep both side by side?**
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
- **The validator's `sprite-needs-texture` rule is kept for now.** Godot shows no warning for a `Sprite2D` without a texture, so this
  rule is a project rule, not a Godot rule. Undecided whether to keep it.
- **Cursor setup for other people** (user): a separate, small profile in `tools/cursor-profile/`: four TypeScript settings and three
  TypeScript extensions only. No keybindings, no personal settings, no machine paths. `launch.sh` runs it beside the normal Cursor.
  The profile forces TypeScript 7 off because it disables every tsserver plugin, which the scene-lint plugin needs.

## Status

| Item | State |
| --- | --- |
| GodotJS to tstogd | decided, no work done yet |
| `extends` check | decided, not built |
| Separate engine repo as a submodule | done: `godot-ts-engine`, mounted in the game repo as `engine/` |
| Class hierarchy in the validator and types | in progress |
| Cursor profile | done, in `tools/cursor-profile/` |
