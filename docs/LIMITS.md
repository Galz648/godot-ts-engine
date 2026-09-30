# Limits, in plain language

Things these tools cannot do, or only do with a catch. Each one says what you would actually see, why it is that way,
and what to do about it. Written 2026-09-30 after the four proofs of concept.

## 1. The emitter overwrites; it does not merge ("two writers")

**The idea.** When you describe a scene in TypeScript and run the emitter, it writes the whole `.tscn` file from scratch.
The TypeScript file is the source of truth. The emitter has no idea what was in the file before.

**A story that shows the problem.**

1. Monday: you write `scene.def.ts` with a Ball and a Wall and run the emitter. `main.tscn` appears.
2. Tuesday: you open `main.tscn` in Godot. You drag the Ball to a nicer position, add a `Timer` node, and save.
   (What we tested: moving a node and saving. The file stayed valid and only the moved node's line changed. Adding
   a new node in the editor was not tested; Godot would give it an id of its own.)
3. Wednesday: you rename the Wall in `scene.def.ts` and run the emitter again.
4. The emitter rewrites the whole file from the TypeScript. **Your Ball position and the Timer are gone**, because they
   were never in the TypeScript. Nothing warns you. The only trace is `git diff`.

**Why.** Merging would mean reading the `.tscn` back and combining it with the TypeScript tree, which is a much bigger
tool. The original plan called the emitter "one-shot scaffolding": run it when the structure changes, then work in Godot.
That only holds if you do not re-run it over a scene you have edited.

**What to do: choose a policy per scene.**

| Policy | Means | Good for |
| --- | --- | --- |
| **Generated** | The scene is only ever changed in TypeScript. Never save it from the Godot editor. Anything visual goes in the tree as `{ raw: "..." }` props. | Mostly-structure scenes: level skeletons, menu layouts |
| **Scaffold once** | Emit it one time, then the Godot editor owns it. Never run the emitter on that file again. | Scenes you will tune by eye: art, animation, UI polish |
| **Split** | A generated scene that instances editor-owned sub-scenes. | Best of both, but **the emitter cannot instance scenes yet** |

**Not built, would help:** a safety check. Before overwriting, the emitter could compare the file on disk with what it
wrote last time and refuse (or warn) if someone edited it. That is small; it just has not been done.

## 2. The editor squiggles need a specific TypeScript setup

**The idea.** The red and yellow squiggles in the editor come from a TypeScript "language service plugin". The editor
only loads such a plugin when it uses **TypeScript 5.9 from the project's `node_modules`**, and only while TypeScript 7
(the "native preview", setting `typescript.experimental.useTsgo`) is **off**.

**What you would actually see.** With TypeScript 7 switched on globally, the plugin never loads. The editor shows:
`TypeScript server plugins from the "ms-vscode.vscode-typescript-tslint-plugin" extension will not be loaded because
TypeScript 7 is enabled globally.` Note that the message names a different, unrelated extension, which makes it easy to
misread, but it is the same cause: no plugin of any kind loads. There are no squiggles from our plugin. That is exactly
what happened to you. It worked once we used a clean profile and picked "Use Workspace Version".

**What you do not lose.** Ordinary TypeScript errors still show, and the validator runs in the build step and finds the
same problems there. The plugin is live feedback while typing. It is not where the rules are enforced.

**What to do.** Use `tools/cursor-profile/launch.sh` (TypeScript 7 off, workspace TypeScript offered), or turn TypeScript 7
off in your own settings while working on scene files. Anyone who wants TypeScript 7 everywhere gives up the live
squiggles. That is the trade-off, and it may change if TypeScript 7 ever supports plugins (we do not know).

## 3. Smaller limits we know about

- **The editor plugin sees only what is written out literally.** Nodes made by a helper function, a loop or a spread are
  opaque to it: it leaves them out and silences the rules that would be wrong without them. In Breakout most nodes come from
  helpers, so the plugin checks the literal skeleton only. The build's validator checks the whole tree; the plugin is live
  feedback, not the gate. A scene whose root is not a literal gets one "not statically analyzable" warning.
- **Only some of Godot's warnings exist here.** We cover a handful of collision-shape rules. Godot has many more, written
  per class, with no exported list; each extra one must be written and checked by hand. The "Sprite2D needs a texture"
  rule is ours, not Godot's (Godot does not warn about it).
- **Class data is from one Godot version (4.7.2).** Regenerate it for another version. Classes from addons are unknown to it.
- **Script variables must go in `scriptProps`.** Godot silently ignores a script's own variables (like an exported
  `is_player`) if they are written before the script is attached. The emitter writes `scriptProps` after the `script` line;
  put such values there, not in `props`. Nothing checks the variable names, and the compiler does not check keys of a
  spread object (see `PONG-PROOF.md`).
- **The emitter cannot share a resource between nodes.** 40 identical shapes become 40 resources. It works; it is bloat.
- **The validator does not check file paths.** Only the typed registry vocabulary catches a wrong script or texture path.
- **Registry keys can be renamed** when a same-named file appears elsewhere (`main` becomes `scriptsPongMain`). Code using the old key stops compiling.
- **The emitter is deliberately small.** No instanced sub-scenes, no `uid://` references, no signal connections, no groups (found again in the Breakout proof: connect and group in code instead).
  Anything else has to go through `{ raw: "..." }`.
- **Connecting a signal in the Godot editor writes into a generated script.** Godot adds the handler stub to the `.gd` file,
  which tstogd overwrites on the next convert; the connection then points at a missing method. Write the handler in the
  TypeScript script first (seen in the hand session, `MILESTONE-1.md`).
- **Registry types are per game.** The path registry is generated from a game's files, so the engine cannot import it
  directly. How the engine's scene type learns a game's paths is the next integration step.
- **Godot exits with status 0 even when a scene fails to load.** Anything automated must read Godot's output, not its exit code.
- **Windows was never run.** Paths are normalised in the code, but nothing was tried there.
- **A fresh Godot project must be imported once** (`godot --headless --import`) before textures load.
