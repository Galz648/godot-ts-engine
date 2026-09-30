# Working in this repo (for AI agents)

A Godot 4.7 game. Scripts are TypeScript compiled to GDScript by tstogd; scenes may be described in TypeScript and
written to `.tscn` by the engine in `engine/` (a git submodule).

## Rules

- Edit `src/scripts/*.ts`, never `scripts/*.gd` or `src/_typings/`: those are generated and overwritten.
- While the build still writes a scene, change its `scene-defs/*.def.ts`, not the `.tscn`. Once the build says a scene is
  "owned by Godot", the build no longer writes it. "matches" and "is behind the scene" are normal, not failures. To change
  such a scene: ask the user to change it in Godot, or run `npm run pull` and then, if the build says TypeScript owns it
  again, edit the definition. A definition whose header says MIRROR does not change its scene: do not edit it.
- A `CONFLICT` means the definition and the scene were both changed. Do not pick a side yourself: ask the user whether to
  keep Godot's (`npm run pull`) or TypeScript's (`npm run build -- --force`, which loses the Godot edits).
- `scene-defs/registry.gen.ts` and `scene-defs/.emitted.json` are generated; commit them, do not edit them.
- Do not edit `engine/`. It is a pinned submodule shared with other games; changes belong in the godot-ts-engine repo.
- After a change, run `npm run build`, then `npm run verify`, then `npm run smoke`. All must pass. The build type-checks
  `scene-defs/` too (`npm run check` alone does just that).
- Never run `npm run build -- --force` without asking: it overwrites scenes that were edited in the Godot editor.
- Change `tests/smoke.gd` when the game changes what it checks (the player, the coin, the score label).
- New script or texture file: `npm run build` regenerates the registry; then use its key (`Scripts.x`, `Textures.y`).

## tstogd scripts

- One exported class per file; the class name becomes the GDScript `class_name` and must be unique in the project.
- Use Godot's types (`float`, `int`, `bool`, `Vector2`) and API names (`Input.is_physical_key_pressed`, `clampf`).
- `@exports` marks an exported variable. A definition sets it with `scriptProps`, not `props` (the build fails otherwise).
- Signal handlers go in the TypeScript script. Connecting a signal in the Godot editor writes a stub into the generated `.gd`,
  and the next convert deletes it: write the method in `src/scripts/` first, then connect it in the editor or in code.
- TypeScript 5.9 only (TypeScript 7 breaks tstogd and the editor plugin).

## Scene definitions

- A definition `export default`s the tree and `export const output = "scenes/x.tscn"`.
- Control nodes (ColorRect, Label) are placed with `offset_*` props; Node2D nodes with `position`.
- Definitions cannot express groups, signal connections or instanced scenes (by design, not planned). Do those in scripts
  (`add_to_group`, `signal.connect(handler)`, `preload(...).instantiate()`), or in the editor after the scaffold. See `engine/docs/LIMITS.md`.

## Checking in Godot

- `godot --headless --import` once after adding a script with a new class name.
- `npm run verify` loads each generated scene headless and compares it, node by node, with its definition.
