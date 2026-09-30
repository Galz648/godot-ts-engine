# {{name}}

A Godot 4 game. Scripts are TypeScript, compiled to GDScript by
[tstogd](https://github.com/nnn3d/typescript-to-gdscript). Scenes can be described in TypeScript too, checked and
written to `.tscn` by [godot-ts-engine](https://github.com/Galz648/godot-ts-engine) (mounted at `engine/`).

## Daily commands

    npm run build      # TypeScript -> GDScript, path registry, check scene-defs/*.def.ts, write their scenes
    npm run dev        # the same, then keep watching
    npm run verify     # load every generated scene in Godot (headless) and compare it with its definition
    npm run smoke      # play the main scene headless: walk right, pick up the coin, check the score
    npm run pull       # rewrite the definition of each scene saved in Godot from that scene
    npm run check      # type-check scene-defs/

Press F5 in Godot to run. The starter: move the blue square with the arrow keys or WASD and collect the coin.

## What the starter shows

| Where | What |
| --- | --- |
| `art/player.svg`, `art/coin.svg` | Textures. The registry lists them as `Textures.player` and `Textures.coin` |
| `scene-defs/main.def.ts` | A body with a sprite and a rectangle shape, an area with a sprite and a circle shape, a HUD |
| `Coin` in the definition | Sets the script's exported `value` (`scriptProps: { value: 5 }`) |
| `src/scripts/coin.ts` | A custom signal, `collected = gd.signal<[value: int]>()`, emitted on `body_entered` |
| `src/scripts/main.ts` | Connects `coin.collected` in code, with a typed handler, and shows the score |
| `tests/smoke.gd` | Plays it headless and fails if the coin cannot be collected or the value got lost |

## How to work

1. **Game logic** goes in `src/scripts/*.ts`. Keep `npm run dev` running; it rebuilds on every save.
2. **A new scene**, one of two ways:
   - **In TypeScript**, when code beats clicking (a grid, 100 bricks, a layout): write `scene-defs/level.def.ts`, iterate with
     `npm run build` and look at it in Godot. When it is right, carry on in Godot if you like (see below).
   - **In Godot**, for everything else: make it in the editor as usual.
3. **Wire things up in scripts**, not in definitions: signals (`this.button.pressed.connect(this.on_press)`), groups
   (`add_to_group`), spawning (`preload("res://x.tscn").instantiate()`). The editor works too, with one rule: write a
   signal's handler in TypeScript first, because the editor puts its stub in the generated `.gd`, which tstogd overwrites.
4. **Press F5** in Godot to play. Run `npm run verify` and `npm run smoke` before committing.

## When a scene is saved in Godot

The build writes a scene only while it is exactly what the build last wrote. Once you save it in Godot, Godot owns it: the
build does not write it, but reads it back, checks it (the same rules as a definition; errors fail the build) and compares it
with the definition:

| The build says | Meaning | What to do |
| --- | --- | --- |
| `owned by Godot; main.def.ts matches it` | Nothing to do | |
| `main.def.ts is behind the scene` + the differences | You edited in Godot only | Nothing, or `npm run pull` to update the definition |
| `CONFLICT` + the differences (fails) | You edited both | `npm run pull` keeps Godot's; `npm run build -- --force` keeps TypeScript's |

`npm run pull` rewrites the `.def.ts` from the scene (script and texture paths as registry keys; helper functions like
`vec()` become literals). If the definition can hold everything in the scene, TypeScript owns it again and you keep editing
the `.def.ts`. If the scene has groups, signal connections made in the editor or instanced scenes, Godot keeps it and the
definition becomes a **mirror**: its header says so, editing it changes nothing, and the build reports it as a conflict.
Details: `engine/docs/DAILY-WORKFLOW.md`, limits: `engine/docs/LIMITS.md`.

## Try breaking it

Each of these is caught before you press F5. Undo with `git checkout .`

| Change | Caught by | Says |
| --- | --- | --- |
| `Textures.player` -> `Textures.plyer` in `main.def.ts` | editor squiggle, `npm run build` | `Property 'plyer' does not exist ... Did you mean 'player'?`; no scene written |
| Delete `art/coin.svg` | `npm run build` | `Property 'coin' does not exist on type '{ readonly player: ... }'` |
| `type: "Area2D"` -> `"Area2d"` | editor squiggle, `npm run build` | `Type '"Area2d"' is not assignable to type 'NodeType'. Did you mean '"Area2D"'?` (untyped definitions get the validator's `"Area2d" is not a Godot class`) |
| Rename `Hint` to `Score` (two siblings named `Score`) | `npm run build` | `Another child of "Hud" is already called "Score"`; nothing written |
| Remove the Coin's `Shape` | `npm run build` (warning), `npm run smoke` | Godot's own "This node has no shape" warning; smoke: `no coin after 300 frames` |
| Remove `script: Scripts.coin` | `npm run build` (a warning, then tstogd fails the build) | `These script variables are ignored because this node has no script`, then `main.ts: ... & Area2D' is missing the following properties from type 'Coin'` |
| Move `value: 5` from `scriptProps` into `props` | `npm run build` (and `verify`, `smoke`) | `"value" is a variable of scripts/coin.gd, so it belongs in scriptProps`; nothing written |
| `value` -> `valu` in the Coin's `scriptProps` | `npm run build` (warning) | `"valu" is not a variable of scripts/coin.gd` |
| `this.get_node('Hud/Scroe')` in `main.ts` | tstogd (`npm run build`) | `Type 'Node \| null' is not assignable to type 'Label'` |
| `on_coin_collected(value: String)` in `main.ts` | tstogd (`npm run build`) | `'(value: String) => void' is not assignable to parameter of type '(value: number) => void'` |
| Move the coin in Godot and save, then change `value` in `main.def.ts` | `npm run build` | `CONFLICT` and the differences |

## Where things are

| Path | What | Edit it? |
| --- | --- | --- |
| `src/scripts/` | Game scripts, in TypeScript | yes |
| `scene-defs/*.def.ts` | Scenes described in TypeScript (`main.def.ts` writes `scenes/main.tscn`) | yes |
| `art/` | Textures | yes |
| `tests/smoke.gd` | The headless play test | yes |
| `scripts/`, `src/_typings/` | Generated by tstogd | no |
| `scene-defs/registry.gen.ts` | Generated: every script, scene and texture path, as types | no |
| `scene-defs/.emitted.json` | What the build last wrote (commit it) | no |
| `scenes/main.tscn` | Generated from `main.def.ts`, until you save it in Godot | in Godot, once you are happy with the scaffold |
| `engine/` | git submodule: godot-ts-engine | no |
| `tools/cursor-profile/` | Opens Cursor with the scene squiggles working | |

## Setup on a new machine

    git clone --recurse-submodules <this repo>
    npm install
    npm run setup:editor               # builds the editor plugin, once
    godot --headless --import          # once: lets Godot learn the scripts' class names
    npm run build

Needs Godot 4.7 on `PATH` (or `GODOT=/path/to/godot`), Node 22+, bun, and TypeScript 5.9 (TypeScript 7 lacks the compiler
API tstogd needs). For live squiggles in scene definitions, open the game with `tools/cursor-profile/launch.sh`.

## Updating the engine

    git -C engine fetch --tags && git -C engine checkout <tag or commit>
    npm run build && npm run verify && npm run smoke
    git add engine && git commit -m "engine: update to <tag>"
