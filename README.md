# godot-ts-engine

TypeScript-to-Godot tooling: describe a scene in TypeScript, check it with readable errors, compile it to a
`.tscn`. Built as four small proofs of concept, now packages in one repo. **They are not integrated yet:**
each package runs on its own, against stubs of the others (see `docs/DECISIONS.md` and each `SESSION.md`).

| Package | What it does | Try it |
| --- | --- | --- |
| `packages/scene` | The one shared scene-tree type (`SceneNode`) the other packages use. Types only. | `bun install && bun run check && bun run check:examples && bun run demo` |
| `packages/build` | The day-to-day command: tstogd, registry, validate, emit, with a watch mode and an overwrite guard. | `bun install && bun run test` (used from the game repo as `npm run build`) |
| `packages/registry` | Scans a Godot project, generates path types (`TexturePath`, `ScenePath`, `ScriptPath`) | `bun install && bun run gen && bun run check` |
| `packages/emitter` | Writes a Godot 4 `.tscn` from a plain TypeScript tree | `bun install && bun run emit && bun run check` |
| `packages/validator` | Structural rules and Godot class hierarchy, human-written messages | `bun install && npm test` |
| `packages/lint-plugin` | TypeScript language-service plugin: validator findings as editor squiggles | `bun install && bun run test` |
| `packages/verify` | Loads each generated scene in headless Godot and compares it, node by node, with its definition | `bun engine/packages/verify/src/verify.ts` from a game's root |
| `packages/create` | Starts a new game from a template, with this engine mounted at `engine/` | `bun install && bun run test` |
| `packages/scene-sync` | Reads a `.tscn` back, diffs two trees, writes a definition from a scene (used by the build's drift notice and `--pull`); plus the frozen three-way merge prototype (`docs/MILESTONE-1.md`) | `bun install && bun run test` |

## Start a new game

**How to work with it, in one page: [`docs/DAILY-WORKFLOW.md`](docs/DAILY-WORKFLOW.md)** (what works, the workflow, what does not).

    npx github:Galz648/godot-ts-engine#v0.1.2 my-game --name "My Game" --engine-ref v0.1.2

Use this form, with the version in both places: `#v0.1.2` picks the template, `--engine-ref v0.1.2` picks the engine the
game is pinned to, and the two must match. Without them you get the template and engine from `main`, which can change
under you. Releases: [github.com/Galz648/godot-ts-engine/releases](https://github.com/Galz648/godot-ts-engine/releases).

It writes a small Godot project (collect-the-coin: one scene definition, three TypeScript scripts, two SVG textures, a
headless smoke test), adds this engine as a submodule pinned to one commit, installs, builds the editor plugin, builds,
imports into Godot, runs `npm run verify` and `npm run smoke`, and makes the first commit. Needs git, Node 22+, bun and
Godot 4.7 on `PATH` (without Godot it skips the import, verify and smoke). The game's README lists ten mistakes to try and
the message that catches each. Options: `--engine-ref <tag|branch|commit>` (default `main`; from a local checkout of this repo, its own
commit, which must be pushed), `--engine-url`, `--no-install`, `--files-only`. The template is `packages/create/template/`; the
new game's `README.md` and `AGENTS.md` explain its daily loop.

**Day-to-day loop: [`docs/DAILY-WORKFLOW.md`](docs/DAILY-WORKFLOW.md).** **What is left: [`docs/REMAINING.md`](docs/REMAINING.md).** `./check-all.sh` runs every check. **The Breakout proof (142 nodes): [`docs/BREAKOUT-PROOF.md`](docs/BREAKOUT-PROOF.md).** **The Pong proof: [`docs/PONG-PROOF.md`](docs/PONG-PROOF.md).** **Using the registry in a game: [`docs/USING-THE-REGISTRY.md`](docs/USING-THE-REGISTRY.md).** **Limits, in plain language: [`docs/LIMITS.md`](docs/LIMITS.md).** Read this before relying on the emitter or the editor plugin.

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
