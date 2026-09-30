# Using the path registry

The registry scans a Godot project and writes one TypeScript file with every texture, scene and script path as a string
literal type. Put those types into the scene type and a typo in a path becomes a normal compile error.

It also writes `Project`, the settings from `project.godot` a definition may need: today the viewport size,
`Project.viewport.width` / `.height` (Godot's defaults, 1152 x 648, when `project.godot` sets nothing). Lay a scene out from
those numbers instead of writing 1152, and changing the size in Godot's Project Settings flows into the next build.

Everything below was run for real. The commands assume the layout of the game repo: this repo mounted at `engine/`.

## 1. Generate it for your game

From the game repo root:

    bun engine/packages/registry/tools/gen-registry.ts . --out scene-defs/registry.gen.ts
    bun engine/packages/registry/tools/gen-registry.ts . --out scene-defs/registry.gen.ts --watch   # regenerate on change

What it wrote for the game repo as it stands today (output written to a scratch file, the game repo was not changed):

    export const Textures = {} as const;
    export type TexturePath = (typeof Textures)[keyof typeof Textures];

    export const Scenes = {
      level: "res://scenes/lightway/level.tscn",
      main: "res://scenes/pong/main.tscn",
    } as const;
    export type ScenePath = (typeof Scenes)[keyof typeof Scenes];

    export const Scripts = {
      scriptsLightwayBall: "res://scripts/lightway/ball.gd",
      level: "res://scripts/lightway/level.gd",
      scriptsPongBall: "res://scripts/pong/ball.gd",
      main: "res://scripts/pong/main.gd",
      paddle: "res://scripts/pong/paddle.gd",
    } as const;
    export type ScriptPath = (typeof Scripts)[keyof typeof Scripts];

- **Keys** are the camelCased file name. When two files would get the same key (here, two `ball.gd`), the folder is added
  (`scriptsLightwayBall`, `scriptsPongBall`); then the extension; then a number.
- **Skipped:** `.godot/`, `node_modules/`, `.git/`, `.import` files, any folder with its own `project.godot` (a separate
  project, which Godot ignores too) and any folder with a `.gdignore` file. That is why `engine/` does not leak its sample
  files into your registry. (Both of those last two were added on 2026-09-30, after this leak was spotted, and tested with a
  nested project and a `.gdignore` folder.)
- **Covers** textures (`.png .jpg .jpeg .webp .svg`), scenes (`.tscn`) and scripts (`.gd`). Not audio, fonts or other resources yet.
- `--out` creates missing folders. Without `--out` the file goes to `packages/registry/src/registry.gen.ts`, which is for the
  registry's own sample and would dirty the submodule in a game.

## 2. Use it in a scene definition

Three lines connect the generated files to the scene type. This is `packages/scene/examples/with-registry.ts`, which runs:

```ts
import { Scripts, Textures, type ScriptPath, type TexturePath } from "./registry.gen";   // your generated file
import type { NodeType } from "<engine>/packages/validator/src/node-types.gen";          // every Godot node class
import type { SceneNode } from "<engine>/packages/scene/src/index";

type Vocab = { type: NodeType; script: ScriptPath; texture: TexturePath };
type GameNode = SceneNode<Vocab>;

const scene: GameNode = {
  name: "Main",
  type: "Node2D",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: Scripts.ball, // or the literal "res://scripts/ball.gd": both are checked
      children: [{ name: "Sprite", type: "Sprite2D", props: { texture: { ext: Textures.ball } } }],
    },
  ],
};
```

A `GameNode` tree can be handed straight to `validate()` and `emitTscn()`: a narrow tree is accepted where the plain one is
expected. Run it: `cd packages/scene && bun run demo:registry` prints `validator: 0 issue(s)` and the emitted `.tscn`.

## 3. What goes wrong, and what you see

`cd packages/scene && bun run check:examples` compiles deliberate typos and counts the errors (3 here, exactly):

| You write | The compiler says |
| --- | --- |
| `script: "res://scripts/bal.gd"` | `Type '"res://scripts/bal.gd"' is not assignable to type '"res://scripts/ball.gd"'.` |
| `texture: { ext: "res://art/bal.png" }` | `... not assignable to type 'TexturePath'. Did you mean '"res://art/ball.png"'?` |
| `type: "Node2Dd"` | `... not assignable to type 'NodeType'. Did you mean '"Node2D"'?` |

Delete `ball.png` and regenerate: every use of `Textures.ball` and of the literal path turns into an error.

## 4. Where the files go in a game repo (not set up yet)

- **Not under `src/`.** tstogd converts every `.ts` under `src/` into GDScript and needs exactly one class per file.
  Use a separate folder such as `scene-defs/`, add `scene-defs` and `scene-defs/**` to `exclude` in `tstogd.json`, and give
  it its own `tsconfig.json` (the game's root one is tstogd's and has no Node or Bun types).
- **Commit the generated file**, so the editor works without running the generator. Regenerate when files are added,
  removed or renamed.
- **The imports into `engine/...` are relative paths into the submodule.** It works because these are type-only imports,
  but it is awkward. Turning that into a proper package import is part of the held registry step (see `STATUS.md`).

## 5. Catches

- The registry only knows the files that existed when it last ran. A new texture has no type until you regenerate.
- The "hand-over" (the `Vocab` lines above) is written by hand in each game. Making that automatic is the held design
  choice in `STATUS.md`; this page is the manual recipe that works today, not an integration.
- Keys can change when a file with the same name appears elsewhere (`ball` becomes `scriptsLightwayBall`).
  Code using `Scripts.ball` then stops compiling, which is at least loud.
