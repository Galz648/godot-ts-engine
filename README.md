# godot-ts-engine

TypeScript-to-Godot tooling: describe a scene in TypeScript, check it with readable errors, compile it to a
`.tscn`. Built as four small proofs of concept, now packages in one repo. **They are not integrated yet:**
each package runs on its own, against stubs of the others (see `docs/DECISIONS.md` and each `SESSION.md`).

| Package | What it does | Try it |
| --- | --- | --- |
| `packages/scene` | The one shared scene-tree type (`SceneNode`) the other packages use. Types only. | `bun install && bun run check && bun run check:examples && bun run demo` |
| `packages/registry` | Scans a Godot project, generates path types (`TexturePath`, `ScenePath`, `ScriptPath`) | `bun install && bun run gen && bun run check` |
| `packages/emitter` | Writes a Godot 4 `.tscn` from a plain TypeScript tree | `bun install && bun run emit && bun run check` |
| `packages/validator` | Structural rules and Godot class hierarchy, human-written messages | `bun install && npm test` |
| `packages/lint-plugin` | TypeScript language-service plugin: validator findings as editor squiggles | `bun install && bun run test` |

**Limits, in plain language: [`docs/LIMITS.md`](docs/LIMITS.md).** Read this before relying on the emitter or the editor plugin.

Each package has a `SESSION.md` with what was built, the commands run, findings and what was not verified.
`docs/pocs/` has the original overview and handover specs.

## Using it from a Godot game repo

Add it as a submodule (the game repo mounts it at `engine/`). `.gdignore` at the root keeps Godot from scanning it.
If the game uses tstogd, exclude `engine` in its `tstogd.json`, because tstogd scans the whole project root.

## Integration status

Short version: the shared scene type, the validator and the emitter are joined (`cd packages/scene && bun run demo`).
The registry, the editor plugin, a `build` command and a real-scene proof are held on purpose, to go slowly.
**Full table, evidence and reasons: [`docs/STATUS.md`](docs/STATUS.md).**

The pipeline the PoCs aim at, for reference: tstogd compiles scripts, the registry scans the project, you write a scene
definition using the registry's path types, the plugin squiggles problems while you type, the validator runs as a build
step, the emitter writes `main.tscn`.
