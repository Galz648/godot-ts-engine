# Where we are

Last updated 2026-09-30. The rule for now, from the user: **go slowly; integrate only the layers that fit together
cleanly, and write down where we stand.** So most of the pipeline is deliberately *not* joined up yet.

## The layers

| # | Layer | Package | State | Evidence (run these) |
| --- | --- | --- | --- | --- |
| 1 | Shared scene type | `packages/scene` | **Integrated** | `cd packages/scene && bun run check && bun run check:examples` (8 expected type errors, exactly) |
| 2 | Validator uses it | `packages/validator` | **Integrated** | `cd packages/validator && npm test` (40 pass) |
| 3 | Emitter uses it | `packages/emitter` | **Integrated** | `cd packages/emitter && bun run emit` (prints `unchanged`: output identical to before the change) |
| 4 | Path registry | `packages/registry` | Standalone, **held**. Usable by hand today: see `USING-THE-REGISTRY.md` | `cd packages/registry && bun run gen && bun run check`; `cd packages/scene && bun run demo:registry` |
| 5 | Editor plugin | `packages/lint-plugin` | Standalone, **held** | `cd packages/lint-plugin && bun run test` |
| 6 | One `build` command | (none yet) | Not started, held | |
| 7 | Proof on a real scene (Pong) | (none yet) | Not started, held | |

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
| Plugin runs the real validator | The plugin reads a top-level `texture` field that the shared type does not have (it is `props.texture: { ext }` now), and it only understands plain literals. It also still calls a two-rule stub. | Rework the plugin's reader for `props`, supply the validator the class data, re-run the editor checks |
| `build` command | Only useful once the pieces above exist; today it would just call two functions in a row. | Wait for 4 and 5, or build a minimal validate-then-emit command on its own |
| Pong proof | The real test, but it will expose what the emitter lacks (Control offsets, theme overrides, etc.). | Do after the above |

## Decisions that shape this

See `DECISIONS.md`. In short: switch the game to tstogd; the `extends` check comes later; the tools live in this repo,
used by the game as a submodule; integrate slowly.

## Known limits

See `LIMITS.md`: the emitter overwrites instead of merging; the editor squiggles need workspace TypeScript 5.9 with
TypeScript 7 off; and a list of smaller ones.

## Not checked anywhere yet

- The shared type in the editor (only `tsc` was run).
- Whether the 253-member node-class union slows the editor when a scene file is large.
- Windows.
