# Overview: TypeScript-to-Godot tooling proofs of concept

Sep 30, 2026 · @HUMONGOUSCOCKOUS

Four small, independent proofs of concept test whether a scene can be described in TypeScript, checked with readable errors, and compiled to a Godot main.tscn, without pushing the type system past simple literal types.

## Intent

Move enforcement out of the type system and into ordinary code that runs at build or edit time, then map its findings back to the editor. The earlier approach encoded scene rules as types, which produced long intersection-type errors that were hard to read and hard to write.

The split, borrowed from how typescript-to-gdscript (tstogd) works:

- Types handle only cheap, obvious checks: asset and script paths as generated string literal unions.
- Structural rules (collision shapes, unique names) are plain functions that return messages written for humans.
- Output is a normal Godot scene. After generation, work happens in Godot and tstogd-compiled scripts as usual.

## The four proofs of concept

Each one runs standalone with stubs, so they can be built in any order; the order below gives the most learning soonest.

| # | Handover doc | What it proves | Uses | Time-box |
| --- | --- | --- | --- | --- |
| 1 | Handover: typed asset & script path registry (PoC 1) | A scan can turn project files into literal types, so path typos are plain TS errors | Nothing | \~2 h |
| 2 | Handover: declarative tree to .tscn emitter (PoC 2) | A plain data tree can be written out as a valid, wired main.tscn | Path types from 1 | \~2 h |
| 3 | Handover: scene tree validator (PoC 3) | Structural rules are a few readable functions, not type gymnastics | Tree type from 2 | \~2 h |
| 4 | Handover: editor squiggles via a language service plugin (PoC 4) | Validator issues can appear as live squiggles on the right node | Validator from 3 | \~3 h |

## How the pieces fit once integrated

Integration is not part of any PoC; this is the picture they're aiming at. The build runs in a straight line, with the editor plugin giving feedback while writing.

1. tstogd compiles TypeScript game scripts into .gd files.
2. The registry generator (PoC 1) scans the project, now including those .gd files, and writes `registry.gen.ts`.
3. You write `scene.def.ts` using the registry's path types; the plugin (PoC 4) squiggles problems as you type.
4. The validator (PoC 3) runs as a build step and stops on errors.
5. The emitter (PoC 2) writes main.tscn, pointing at the compiled scripts.
6. Godot opens a fully wired scene; from here you work in Godot and the scripts as usual.

Steps 2 to 5 rerun only when the scene structure changes, not on every script edit.

## Working method and open questions

Each PoC is handed to an agent on its own, time-boxed, with Node built-ins only and a SESSION.md capturing intent, tasks, what was completed, findings and next steps. Acceptance checks are run by hand, so the result is understood, not just produced.

Open questions to settle after the PoCs:

- Whether to switch the game from GodotJS to tstogd, or keep both approaches side by side for now.
- Whether step 4's validator should also check a script's `extends` against its node type.
- Where these tools live: in the game repo, or in a separate engine-layer repo or submodule.
