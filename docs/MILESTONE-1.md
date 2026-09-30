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
- **Not yet measured:** what the real Godot editor writes. Everything above about editor output is from a synthetic file I wrote. To measure it: copy `scenes/pong/main.generated.tscn` to a scratch scene, open it in Godot and do: change Ball's `offset_left`, add a Timer under Main, put Enemy in group `enemies`, rename ScoreLabel to Score, drag Enemy above Player, instance `scenes/lightway/level.tscn` under Main, save. Then run `bun packages/scene-sync/src/analyze.ts packages/scene-sync/sample/pong-base.tscn <the saved file>`.

## What is left

See `REMAINING.md`. Next in line: the real-editor measurement above, then the scene policy decision, then the registry key choice.
