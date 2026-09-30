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
| `src/scripts/main.ts` | Connects every coin's `collected` in code, with a typed handler, and shows the score |
| `tests/smoke.gd` | Plays it headless and fails if the coin cannot be collected or the value got lost |
| `Project.viewport` in the definition | The viewport size from `project.godot`: every position in `main.def.ts` is derived from it |

## How to...

Start `npm run dev` in a terminal and leave it running: every recipe below is then just "edit, save, look". Without it,
run `npm run build` after each change. Press F5 in Godot to play.

The recipes that edit `scene-defs/main.def.ts` work while the build owns `scenes/main.tscn`. Once you save that scene in
Godot, make scene changes in Godot instead, or run `npm run pull` first (see "When a scene is saved in Godot").

### Change the screen size

1. In Godot: Project > Project Settings > Display > Window > Viewport Width and Viewport Height. (Or edit
   `window/size/viewport_width` and `viewport_height` in `project.godot`.)
2. Save. The build regenerates `Project.viewport` in `scene-defs/registry.gen.ts` and rewrites the scene: the background,
   the player, the coin and the hint all follow, because `main.def.ts` places them from `Project.viewport`, never from
   fixed numbers. Do the same in your own definitions: `const { width: W, height: H } = Project.viewport;`.
3. In scripts, read the size while the game runs: `this.get_viewport_rect().size`.

The stretch mode is `canvas_items`, so the game always sees exactly that size; a bigger window scales it up.

### Change the game's name (the window title)

Project > Project Settings > Application > Config > Name (or `config/name` in `project.godot`).

### Change the background colour

In `scene-defs/main.def.ts`, the `Background` node: `color: { raw: "Color(0.08, 0.09, 0.12, 1)" }`. The four numbers are
red, green, blue and opacity, each from 0 to 1.

### Make the player faster or slower

- For every player: `speed` in `src/scripts/player.ts` (`@exports speed: float = 360.0`).
- For this scene only: add `scriptProps: { speed: 500 }` to the `Player` node in `main.def.ts`. Script variables go in
  `scriptProps`, never in `props`; the build tells you if you mix them up.

### Change the controls

In `src/scripts/player.ts`, the `Key.KEY_...` names (`Key.KEY_LEFT`, `Key.KEY_A`, ...). Your editor autocompletes them.

### Change what a coin is worth, or add another coin

- Worth: `scriptProps: { value: 5 }` on the `Coin` node in `main.def.ts`.
- Another coin: copy the whole `Coin` block in `main.def.ts`, give the copy a new `name` (`"Coin2"`: names must be unique)
  and a new `position`. No code needed: `main.ts` connects every coin directly under `Main`.

### Replace a picture, or add a new one

- Replace: save your file over `art/player.svg` or `art/coin.svg` (same name). PNG, JPG, WebP or SVG.
- Add: put the file in `art/`, for example `art/big-rock.png`. The build lists it in the registry as `Textures.bigRock`
  (the file name, in camelCase), and your editor autocompletes it. Use it on a sprite:
  `{ name: "Rock", type: "Sprite2D", props: { position: vec(100, 100), texture: { ext: Textures.bigRock } } }`.
- Godot has to import a new or replaced picture before it shows: keep the Godot editor open (it does that by itself), or
  run `godot --headless --import`.

### Give a node its own behaviour (a new script)

1. Create `src/scripts/spinner.ts` with one exported class, named after what it does (class names must be unique):

       export class Spinner extends Sprite2D {
         @exports turns_per_second: float = 0.5;

         _process(delta: float): void {
           this.rotation += this.turns_per_second * TAU * delta;
         }
       }

2. Attach it in the definition: `script: Scripts.spinner` on a `Sprite2D` node, and set its variable there if you like:
   `scriptProps: { turns_per_second: 1 }`.
3. If another script refers to the new class by name (`import { Spinner } from './spinner'`), run
   `godot --headless --import` once (or have the editor open), so Godot learns the name.

### Add another scene (a level)

1. Copy `scene-defs/main.def.ts` to `scene-defs/level2.def.ts` and change its last line to
   `export const output = "scenes/level2.tscn";`. Change whatever you like in it.
2. The build writes `scenes/level2.tscn`, and `npm run verify` checks it too.
3. To go there from a script: `this.get_tree().change_scene_to_packed(preload("res://scenes/level2.tscn"));`. Use
   `preload`: a wrong path is then an error in the build (`Preload file ... does not exist`), not a crash while playing.
4. To start the game on it: Project > Project Settings > Application > Run > Main Scene.

### Keep working on a scene in the Godot editor

Just do it and save. From then on the build no longer writes that scene; it tells you how the definition and the scene
compare instead. See "When a scene is saved in Godot" below.

### Undo an experiment

`git checkout .` puts every tracked file back as it was at the last commit (`git status` shows what changed; new files you
added stay: delete them by hand).

### Check everything before committing

    npm run build && npm run verify && npm run smoke

The smoke test walks the player right from where it starts until it touches the `Coin`. If you move them off one line or
remove the coin, change `tests/smoke.gd` to match.

### When the build says...

| Message | What it means | What to do |
| --- | --- | --- |
| `scene-defs: 1 type error; no scene written` | A typo, or a picture or script that no longer exists | Read the line above it: it names the file and says what is wrong |
| `FAILED validation, nothing written` | The scene would be broken in Godot (two nodes with one name, not a Godot class, ...) | The line above it says which node and how to fix it |
| `warning: ...` | Godot would warn about this too (a body without a shape, ...) | Fix it or ignore it: the scene is still written |
| `owned by Godot; main.def.ts matches it` | You saved the scene in Godot, and nothing differs | Nothing |
| `main.def.ts is behind the scene` | You changed the scene in Godot | Nothing, or `npm run pull` |
| `CONFLICT` | You changed both the definition and the scene | `npm run pull` keeps Godot's, `npm run build -- --force` keeps yours |
| `Could not find type "X" in the current scope` | Godot does not know a new class name yet | `godot --headless --import` once, or open the Godot editor |
| `NOT WRITTEN: ... this tool never wrote it` | The definition's `output` is a scene you made yourself | Pick another `output` |
| `SMOKE FAIL: ...` | The play test found a problem: `no coin after 300 frames` means the player never reached the coin | Read the rest of the message; see "Check everything before committing" |

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
| Remove `script: Scripts.coin` | `npm run build` (warning), `npm run smoke` | `These script variables are ignored because this node has no script`; smoke: `the Coin node has no coin script` |
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
