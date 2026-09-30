# Limits, in plain language

Things these tools cannot do, or only do with a catch. Each one says what you would actually see, why it is that way,
and what to do about it. Written 2026-09-30 after the four proofs of concept.

## 1. The emitter overwrites; it does not merge ("two writers")

**The idea.** When you describe a scene in TypeScript and run the emitter, it writes the whole `.tscn` file from scratch.
The TypeScript file is the source of truth. The emitter has no idea what was in the file before.

**A story that shows the problem.**

1. Monday: you write `scene.def.ts` with a Ball and a Wall and run the emitter. `main.tscn` appears.
2. Tuesday: you open `main.tscn` in Godot. You drag the Ball to a nicer position, add a `Timer` node, and save.
   (Tested by hand in the Godot 4.7.2 editor, `MILESTONE-1.md`: moving a node, adding a Timer, a group, a rename, a
   reorder. The file stayed valid; Godot also added a `unique_id` to every node and `uid`s to the header.)
3. Wednesday: you rename the Wall in `scene.def.ts` and run the emitter again.
4. Run by hand, the emitter rewrites the whole file from the TypeScript. **Your Ball position and the Timer are gone**,
   because they were never in the TypeScript.

**Why.** Merging would mean reading the `.tscn` back and combining it with the TypeScript tree. A prototype of that exists
(`packages/scene-sync`), and the measurements show the editor adds things the model cannot hold (groups, connections,
instances), so the merge is **frozen**.

**What we do: scaffold once, with pull** (decided 2026-10-01, pull added 2026-10-02). `npm run build` rewrites a scene only
while it is exactly what the build last wrote. On Wednesday it sees your Tuesday save and does **not** write the scene
("owned by Godot"), so your edits survive; `npm run verify` skips it. It reads the scene back and tells you what differs:
Wednesday's rename is a **conflict** (both sides changed), which fails the build and offers two ways out:
`npm run pull` rewrites `scene.def.ts` from the scene (your rename is lost, the Ball position and Timer are kept), and
`npm run build -- --force` rewrites the scene (the other way round). If you had not touched the definition, the build would
only say it is behind. Running the emitter directly (not through `npm run build`) has no guard: do not.

**The catches of pull.**

- It picks a side; it does not merge. Both-sided edits mean redoing one side by hand.
- A pulled definition is one literal tree: helper functions (`vec()`), loops and comments of the hand-written file are gone.
  Use git to get them back if you prefer to redo the Godot change in TypeScript instead.
- A scene with groups, editor connections, instanced scenes or non-texture resources can only be pulled as a **mirror**: the
  definition shows the tree, but the build never writes that scene again, and editing the mirror is reported as a conflict.
- The comparison is by node path, so a rename in Godot reads as one node removed and one added.

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
- **The emitter is deliberately small, and frozen there.** No instanced sub-scenes, no `uid://` references, no signal connections, no groups (found again in the Breakout proof: connect and group in code instead, where tstogd types them, or add them in the editor after the scaffold).
  Anything else has to go through `{ raw: "..." }`.
- **Connecting a signal in the Godot editor writes into a generated script.** Godot adds the handler stub to the `.gd` file,
  which tstogd overwrites on the next convert; the connection then points at a missing method. Write the handler in the
  TypeScript script first (seen in the hand session, `MILESTONE-1.md`).
- **Registry types are per game.** The path registry is generated from a game's files, so the engine cannot import it
  directly. How the engine's scene type learns a game's paths is the next integration step.
- **Godot exits with status 0 even when a scene fails to load.** Anything automated must read Godot's output, not its exit code.
- **Windows was never run.** Paths are normalised in the code, but nothing was tried there.
- **A fresh Godot project must be imported once** (`godot --headless --import`) before textures load, and before tstogd's
  Godot check knows the scripts' class names (`Could not find type "Coin" in the current scope` until then). The generator
  runs build, import, build for this reason.
- **A script variable put in `props` instead of `scriptProps` passes the build.** Godot drops it silently. `npm run verify`
  catches it (`Coin.value: expected number 5.0, got 1`), and so does the template's smoke test.
