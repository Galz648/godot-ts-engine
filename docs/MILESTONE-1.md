# Milestone 1: the daily loop exists (2026-09-30)

Tagged `milestone-1` in both repos: `godot-ts-engine` (this one) and `godot-ts-playground` (the game repo, which mounts this at `engine/`).

## What exists and is checked

- Registry, emitter, validator (with Godot's class hierarchy), shared scene type, `build` command with an overwrite guard, and an editor plugin.
- Two real scenes proven against Godot: Pong (6 nodes) and Breakout (142 nodes, 706 checks, played headless).
- The plugin seen working in the Cursor editor (user-run). Every engine check: `./check-all.sh`.
- Daily commands in the game repo: `npm run build`, `npm run dev`. Guide: `DAILY-WORKFLOW.md`.

## Decisions as of this milestone

- **No GodotJS migration exists.** tstogd only.
- **Game repo renamed** to `godot-ts-playground`.
- **`sprite-needs-texture` stays** (a warning: it fires on neither real scene, and its message now says "unless a script sets one"). It is our rule, not Godot's.
- **Registry keys** (what it is): the registry names each file by its file name (`Scripts.paddle`). When two files share a name, the keys change (`Scripts.main` became `scriptsPongMain` when Breakout added a `main.gd`) and old code stops compiling. The open choice is to always include the folder (`scriptsPongMain`) so keys never change, at the cost of longer names. Not decided.
- **Generated or editor-owned scenes: undecided.** The user's leaning: generate a scene once from the IDE, then work in the IDE for scripts. The decision waits on how hard syncing is (below).

## Sync analysis so far (`packages/scene-sync`, a prototype)

Reading a `.tscn` back into the scene type plus a three-way merge (last written / new TypeScript / what the editor saved) is **195 lines** with 9 tests.
- Reading then writing is **lossless for everything the emitter can write**: Pong (including the hand-made one), Lightway and Breakout round-trip identically in Godot, and Breakout's round trip is byte-identical.
- The cost is **what the editor can add that the model cannot hold**: groups, signal connections, instanced scenes, non-texture resources (audio, scenes). The reader reports these; written back from TypeScript they would be lost until the emitter supports each one.
- A rename looks like delete plus add; reordering children is not merged.

### Measured with Godot's own scene writer (2026-09-30)

`packages/scene-sync/measure/scripted-edits.gd` does the seven edits below (plus one signal connection) through Godot's API and
saves with `ResourceSaver`, the writer the editor's Save uses. The files it wrote are in `packages/scene-sync/measure/`. This is
real Godot 4.7.2 output, but **not the editor UI**: dragging a Control in the 2D view can add layout and anchor properties that a
script does not. The hand session below is still the last word.

What saving adds, with no edits at all (`godot-noop-save.tscn`):
- A **`unique_id=`** on every node (random, new in Godot 4.6+). Kept on later saves once written. The emitter does not write it, so
  a scene the emitter rewrites loses its ids and Godot makes new ones: git noise, and a risk for anything that refers to nodes by id.
- Whole numbers become floats (`1152` to `1152.0`); `load_steps` is dropped from the header. The reader treats both as equal.
- New random `ext_resource` ids, again on every save (`godot-noop-save-twice.tscn`). A scripted-save artifact: the editor keeps
  them (confirmed in the hand session below).
- The analyzer: 0 changes, 0 losses. So open-and-save alone costs nothing the model can see.

After the edits (`godot-edited.tscn`), the analyzer reports:
- Seen and merged: Ball `offset_left` 568 to 500; Timer added.
- Seen but mangled: rename ScoreLabel to Score shows as delete plus add; the Enemy/Player reorder is dropped by the merge.
- **Lost if written back from TypeScript (3):** Enemy's group, the instanced `level.tscn`, the `timeout` connection.

Read for the scene policy: an editor-owned scene that uses groups, instances or signals **cannot** be regenerated from TypeScript
without losing work, and even a plain one loses its `unique_id`s. That supports "generate once, then the editor owns it".

### Measured by hand in the Godot 4.7.2 editor (2026-10-01)

The user did the session in the editor UI. Files: `measure/editor-hand-save.tscn` (the Pong copy) and
`measure/editor-hand-level-connection.tscn` (a Timer and a signal connection that went into `scenes/lightway/level.tscn` by
mistake; its base is `measure/level-base.tscn`). The analyzer on the Pong copy:
- Seen and merged: Ball moved (set in the Inspector as Layout > Transform > Position x = 500), which the editor wrote as **both**
  `offset_left` 568 to 500 and `offset_right` 584 to 516 (the width is kept). Timer added.
- Seen but mangled, as predicted: the rename (delete plus add) and the Enemy/Player reorder (dropped by the merge).
- **Lost if written back from TypeScript:** Enemy's group; and, in the level file, the `timeout` connection.
- The instanced scene is not in the saved file (the step was skipped or not saved), so that part rests on the scripted run.

What the real editor adds beyond the scripted run:
- A scene **`uid=`** in the header and a **`uid=`** on every `ext_resource` line. The reader ignores both (harmless metadata).
- `ext_resource` ids are **kept** (`1_main`, `2_paddle`, as the emitter wrote them), so the id churn above was the script's.
- Same as scripted: `unique_id` on every node, floats for whole numbers, `load_steps` dropped.
- Setting the position in the Inspector added **no** `layout_mode` or anchor properties. Dragging in the 2D view was not tried.
- **Connecting a signal writes into a generated file.** Godot added `func _on_timer_timeout(): pass` to `scripts/lightway/level.gd`,
  which tstogd generates. The next `npm run convert` overwrites it from the TypeScript, the method is gone and the connection
  fails at run time. With tstogd, write the handler in TypeScript first, then connect it in the editor (or connect in code).
- Opening the project in the editor also wrote a missing `.uid` file next to a script (`sim-breakout.gd.uid`).

Result: the scripted measurement holds. For the scene policy, "generate once, then the editor owns it" is supported, with one
new rule for editor-owned scenes: signal handlers live in the TypeScript script, never in the generated `.gd`.

### Repeating the hand session

From the game repo root, `mkdir -p scenes/scratch && cp scenes/pong/main.generated.tscn scenes/scratch/measure.tscn && cp scenes/pong/main.generated.tscn /tmp/measure-base.tscn`. Open `scenes/scratch/measure.tscn` in Godot and do: change Ball's `offset_left`, add a Timer under Main, put Enemy in group `enemies`, rename ScoreLabel to Score, drag Enemy above Player, instance `scenes/lightway/level.tscn` under Main, save. Then, from `engine/`, run `bun packages/scene-sync/src/analyze.ts /tmp/measure-base.tscn ../scenes/scratch/measure.tscn`. The base must be the unedited copy of the same file: `sample/pong-base.tscn` is a 3-node test sample, and diffing against it reports Player, Ball and ScoreLabel as editor additions.

## What is left

See `REMAINING.md`. Next in line: the scene policy decision (the measurements above are in), then the registry key choice.
