# godot-ts-engine

TypeScript-to-Godot tooling: describe a scene in TypeScript, check it with readable errors, compile it to a
`.tscn`. Built as four small proofs of concept, now packages in one repo. **They are not integrated yet:**
each package runs on its own, against stubs of the others (see `docs/DECISIONS.md` and each `SESSION.md`).

| Package | What it does | Try it |
| --- | --- | --- |
| `packages/registry` | Scans a Godot project, generates path types (`TexturePath`, `ScenePath`, `ScriptPath`) | `bun install && bun run gen && bun run check` |
| `packages/emitter` | Writes a Godot 4 `.tscn` from a plain TypeScript tree | `bun install && bun run emit && bun run check` |
| `packages/validator` | Structural rules and Godot class hierarchy, human-written messages | `bun install && npm test` |
| `packages/lint-plugin` | TypeScript language-service plugin: validator findings as editor squiggles | `bun install && bun run test` |

Each package has a `SESSION.md` with what was built, the commands run, findings and what was not verified.
`docs/pocs/` has the original overview and handover specs.

## Using it from a Godot game repo

Add it as a submodule (the game repo mounts it at `engine/`). `.gdignore` at the root keeps Godot from scanning it.
If the game uses tstogd, exclude `engine` in its `tstogd.json`, because tstogd scans the whole project root.

## Planned integration (not done)

The pipeline the PoCs aim at: tstogd compiles scripts, the registry scans the project, you write a scene definition
using the registry's path types, the plugin squiggles problems while you type, the validator runs as a build step,
the emitter writes `main.tscn`. What that still needs: one shared `SceneNode` type (the packages have three
different ones today), the validator behind the plugin, and one CLI that runs the steps in order.
