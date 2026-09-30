# Where we are

Last updated 2026-09-30. The rule for now, from the user: **go slowly; integrate only the layers that fit together
cleanly, and write down where we stand.** So most of the pipeline is deliberately *not* joined up yet.

**What is left, in order, with the decisions only the owner can make: [`REMAINING.md`](REMAINING.md).** One command runs
every check: `./check-all.sh`.

## The layers

| # | Layer | Package | State | Evidence (run these) |
| --- | --- | --- | --- | --- |
| 1 | Shared scene type | `packages/scene` | **Integrated** | `cd packages/scene && bun run check && bun run check:examples` (expected type errors, exactly: 8 in one file, 3 in the registry example) |
| 2 | Validator uses it | `packages/validator` | **Integrated** | `cd packages/validator && npm test` (40 pass) |
| 3 | Emitter uses it | `packages/emitter` | **Integrated** | `cd packages/emitter && bun run emit` (prints `unchanged`: output identical to before the change) |
| 4 | Path registry | `packages/registry` | Standalone, **held**. Usable by hand today: see `USING-THE-REGISTRY.md` | `cd packages/registry && bun run gen && bun run check`; `cd packages/scene && bun run demo:registry` |
| 5 | Editor plugin | `packages/lint-plugin` | **Reworked**: real validator, shared type, tolerant of helpers and loops. Checked against a real tsserver and on the real Pong/Breakout definitions, and **seen working in the Cursor editor** (user, 2026-09-30: no squiggles on a clean file, class typo, duplicate names, undo). Sees only the literal parts of a definition (`LIMITS.md`). | `cd packages/lint-plugin && bun run test`; `node test/check-file.mjs` |
| 6 | One `build` command | `packages/build` | **Done (minimal)**: convert, registry, validate, emit, convert again; `--watch`; an overwrite guard. See `DAILY-WORKFLOW.md`. | `cd packages/build && bun run test`; `npm run build` in the game repo |
| 7b | Second proof: a bigger scene (Breakout, 142 nodes) | game repo `scene-defs/` | **Done**: 706 checks against the tree, 0 problems; the real physics plays (see `BREAKOUT-PROOF.md`). Found 5 things, no engine bug. | `npm run verify:breakout`, `npm run sim:breakout` |
| 7 | Proof on a real scene (Pong) | game repo `scene-defs/` | **Done**: generated scene identical to the hand-made one in Godot (see `PONG-PROOF.md`). Found and fixed one real bug (`scriptProps`). | `npm run scenes:pong`, then the dump and simulation in `PONG-PROOF.md` |
| 8 | Scene sync (read `.tscn` back, three-way merge, analyzer) | `packages/scene-sync` | **Prototype**, not wired into `build`. Lossless for what the emitter writes; reports (does not drop) groups, connections, instances, non-texture resources. Measured on real Godot 4.7.2 output (scripted edits, Godot's scene writer); the hand session in the editor UI is still open (see `MILESTONE-1.md`). | `cd packages/scene-sync && bun run test && bun run check` |
| 9 | Game template and generator | `packages/create`, `packages/verify` | **Done**: `npx github:Galz648/godot-ts-engine my-game`. Checked end to end on a throwaway copy of this repo: build, Godot import, verify (4 nodes, 25 checks), editor plugin on the new game's scene file, and the starter square moving when a key is held (headless). The `npx github:` route itself needs this pushed. | `cd packages/create && bun run test`; the end-to-end run is in `REMAINING.md` |

Layers 1-3 together: `cd packages/scene && bun run demo` passes **one tree** to the validator and the emitter. The
good tree gives 0 findings and is written as a 4-node scene; the same tree minus its collision shape gives 1 validator
warning and is still written (the emitter trusts its input, by design).

## What "integrated" means here, exactly

- There is one `SceneNode` type, in `packages/scene/src/index.ts`. The validator and the emitter import it; neither
  defines its own any more.
- The type takes a "vocabulary" (which node classes, script paths and texture paths a tree may name). Plain strings by
  default. A game can narrow it with generated types, and a narrow tree is always accepted where the plain one is expected.
- It is only **types**. There is no runtime link between the packages: the validator and the emitter do not call each
  other. They happen to accept the same data.
- Nothing runs them in order yet. A person (or the demo) calls the validator, then the emitter.

## Why the rest is held

| Held | Why it is not clean yet | What it would need |
| --- | --- | --- |
| Registry types in the scene type | The registry is generated per game; the engine cannot import a game's file. Needs a design choice (the game passes its types in, or the engine reads them from a known path). | Decide the hand-over mechanism, then a small change and a test |

## Decisions that shape this

See `DECISIONS.md`. In short: tstogd only (there is no GodotJS migration); the `extends` check comes later; the tools live in this repo,
used by the game as a submodule; integrate slowly.

## Known limits

See `LIMITS.md`: the emitter overwrites instead of merging; the editor squiggles need workspace TypeScript 5.9 with
TypeScript 7 off; and a list of smaller ones.

## Not checked anywhere yet

- The shared type in the editor (only `tsc` was run).
- Whether the 253-member node-class union slows the editor when a scene file is large.
- Windows.
