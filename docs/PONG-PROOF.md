# The Pong proof

2026-09-30. The real-scene test: describe Pong's scene in TypeScript, run it through the registry, the shared type, the
validator and the emitter, and check the result against the scene that was built by hand in the Godot editor.
Everything below was run. The scene definition lives in the game repo at `scene-defs/pong.def.ts`.

## Result: it works

The generated scene is equivalent to the hand-made one. Two checks, both run in Godot 4.7.2:

1. **Property dump.** Load each scene, walk every node and print its class, script, offsets, size, colour, label text and
   alignment, font size, and the script's exported variables. The two dumps are identical (6 nodes).
2. **Seeded simulation.** Run the same 120-second headless game on each scene with the same random seed, including a held
   key. Both gave the same start velocity, the same final score (0 : 26), the same top ball speed (452.6) and the same
   paddle behaviour.

Validator on the definition: `ok: no issues`. TypeScript on it: clean, with script paths checked against the game's
registry and node classes against Godot's class list.

## What the text diff still shows (all harmless, all proven equal by the dump)

- `[gd_scene load_steps=4 format=3]` versus `[gd_scene format=3]`: the 4.7 editor no longer writes `load_steps`.
- `offset_left = 40` versus `40.0`: Godot reads both as the same number.
- The position of the `script` line among the other properties (see the bug below, which is the one that mattered).

## The bug it found

The first generated scene loaded, but the Enemy paddle had `is_player = true` where the hand-made one had `false`.
The AI paddle would have been a second human paddle. No error, no warning.

Cause: the emitter wrote the node's properties first and the `script` line last. Godot only accepts a script's own
variables (the ones the script declares, like an `@exports is_player`) **after** the script is attached. Written before
it, Godot drops them silently. Confirmed by moving one line in a copy of the generated scene: the value then loaded.

Fix (tested, in the engine): a new optional field `scriptProps` on the shared scene node, for the script's own
variables. The emitter writes it after the `script` line. The validator warns (`script-props-need-script`) if a node has
`scriptProps` but no script. Emitter tests (3) and a validator fixture cover it. The original handover's example output
did not change.

## What the emitter already handled

Control nodes placed with `offset_*` numbers, a colour (`{ raw: "Color(...)" }`, the only raw value used), label text and
alignment, a property name with a slash (`"theme_override_font_sizes/font_size"`), and the same script on two nodes
(one shared resource id). Nothing else had to be added for Pong.

## Honest numbers

- The TypeScript definition is about 60 lines, the hand-made scene about 45. TypeScript is not shorter. What it buys is
  checking: a wrong script path, a mistyped class or a forgotten shape is caught before Godot opens the file.
- Pong has no signals, groups, sub-resources or instanced scenes, so none of those were exercised.

## Things the proof exposed about setup

- The game repo's `package.json` says `"type": "commonjs"`, so Node could not load the definition file. A small
  `scene-defs/package.json` with `"type": "module"` scopes the folder to ES modules.
- tstogd scans the whole project, so `scene-defs` is in the `exclude` list of `tstogd.json`.
- The definition imports the engine's types by relative path into the submodule (`../engine/packages/...`).
- TypeScript does not check the keys of an object that is spread into a literal. The definition builds the Enemy's
  `scriptProps` through a spread, and it compiled even against the old type that had no such field. So a misspelled key
  inside a spread is not caught by the compiler. The validator does not know script variable names either.
- The generated scene was not opened in the Godot editor; it was loaded through Godot's loader (same code path). It has no
  `uid://` in its header, as before.

## Still true after the proof

The limits in `LIMITS.md` stand. In particular the emitter overwrites: the game keeps both scenes, the hand-made one as
the project's main scene and the generated one as the proof, so nothing is overwritten.
