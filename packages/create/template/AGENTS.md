# Working in this repo (for AI agents)

A Godot 4.7 game. Scripts are TypeScript compiled to GDScript by tstogd; scenes may be described in TypeScript and
written to `.tscn` by the engine in `engine/` (a git submodule).

## Rules

- Edit `src/scripts/*.ts`, never `scripts/*.gd` or `src/_typings/`: those are generated and overwritten.
- Edit `scene-defs/*.def.ts`, never a scene it writes (its `output`). `scene-defs/registry.gen.ts` is generated.
- Do not edit `engine/`. It is a pinned submodule shared with other games; changes belong in the godot-ts-engine repo.
- After a change, run `npm run build`, then `npm run verify`. Both must pass. `npm run check` type-checks `scene-defs/`.
- Never run `npm run build -- --force` without asking: it overwrites scenes that were edited in the Godot editor.
- New script or texture file: `npm run build` regenerates the registry; then use its key (`Scripts.x`, `Textures.y`).

## tstogd scripts

- One exported class per file; the class name becomes the GDScript `class_name` and must be unique in the project.
- Use Godot's types (`float`, `int`, `bool`, `Vector2`) and API names (`Input.is_physical_key_pressed`, `clampf`).
- `@exports` marks an exported variable. A definition sets it with `scriptProps`, not `props`.
- TypeScript 5.9 only (TypeScript 7 breaks tstogd and the editor plugin).

## Scene definitions

- A definition `export default`s the tree and `export const output = "scenes/x.tscn"`.
- Control nodes (ColorRect, Label) are placed with `offset_*` props; Node2D nodes with `position`.
- The model cannot express groups, signal connections or instanced scenes yet. Do those in scripts
  (`add_to_group`, `connect`, `preload(...).instantiate()`), or hand the scene to the editor. See `engine/docs/LIMITS.md`.

## Checking in Godot

- `godot --headless --import` once after adding a script with a new class name.
- `npm run verify` loads each generated scene headless and compares it, node by node, with its definition.
