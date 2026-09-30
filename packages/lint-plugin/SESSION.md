# PoC 4 session: editor squiggles via a language service plugin

Date: 2026-09-30. Spec: `pocs/Handover editor squiggles via a language service plugin (PoC 4).md` (the only handover read).

## Intent

A tsserver plugin that runs the scene validator on `*.def.ts` and shows each issue as a squiggle on the offending
node's `name` property, live, for unsaved buffers. The thing to learn is how the mapping from a validator issue back to a
character range works and where it breaks.

## Tasks

1. Bun workspace in `pocs/poc4-plugin/`, TypeScript pinned `~5.9` (TS 7 has no classic language-service API).
2. `plugins/scene-lint/`: the plugin (`src/index.ts`, CommonJS output via `tsc`).
3. **Stub** PoC 3 inside `plugins/scene-lint/stub/` (`types.ts`, `validate.ts`, `registry.stub.ts`). PoC 3 was not read or imported.
4. `sample/`: `tsconfig.json` with `"plugins": [{ "name": "scene-lint" }]`, `level.def.ts`, `other.ts`.
5. `test/run.mjs`: drives a real tsserver over its stdin/stdout protocol (what an editor does) and checks each criterion.
6. Run everything; record below. Editor-only checks are **NOT RUN** (I have no editor).

## Completed

- Plugin works end to end against a real `tsserver` (TypeScript 5.9.3): 16 automated checks, all PASS, run twice.
- Every acceptance criterion was verified at the tsserver level. In the Cursor editor, criteria 1, 3, 4 and 5 were then
  run by hand by the user and passed, and so did criterion 6 (deliberate throw); criteria 2 (undo clears) and
  7 (feel / speed) are still NOT RUN in the editor. See the table and "Editor run".

Run it yourself:

```
cd pocs/poc4-plugin
bun install
bun run test        # = tsc -p plugins/scene-lint && node test/run.mjs
```

## How it works (what the code does)

1. `create(info)` returns a proxy of `info.languageService`: every method is forwarded; `getSemanticDiagnostics` is overridden.
2. The override first computes the normal diagnostics and keeps them. Only if the file ends in `.def.ts` does it go on.
3. Source comes from `inner.getProgram().getSourceFile(file)`: it reflects the editor's unsaved buffer.
4. `readTree` finds `const scene = { ... }` (unwrapping `satisfies` / `as` / parentheses) and walks the object literal into
   `SceneNode` data, filling a `Map<SceneNode, ObjectLiteralExpression>`. Anything that is not a plain literal throws `NotStatic(at, reason)`.
5. `validate(tree)` returns issues carrying the `SceneNode` object they are about. The plugin looks that object up in the map
   (by identity), finds the `name: ...` property of that literal, and emits `{ start, length, category, code: 90001, source: "scene-lint" }`.
6. A `NotStatic` becomes a single diagnostic (code 90002, warning) on the offending expression, and the validator is not run.
7. The whole override is in try/catch; on any exception it logs via `info.project.projectService.logger` and returns the normal diagnostics.

## Acceptance criteria: what actually happened

Command: `node test/run.mjs` (after `bun run build`). Edits are sent as tsserver `change` requests on an opened buffer;
the test confirms the files on disk are byte-identical afterwards, so these are unsaved-buffer cases.

| # | Criterion | tsserver-level result | In the editor |
| --- | --- | --- | --- |
| 1 | Deleting the CollisionShape2D from Ball puts a yellow squiggle on `name: "Ball"` without saving | PASS: `[scene-lint 90001 warning] "name: \"Ball\"" "CharacterBody2D "Ball" has no CollisionShape2D or CollisionPolygon2D child, so it cannot collide."`, span start = first `name: "Ball"` | **PASS (by hand, by the user)**: yellow squiggle on Ball, after selecting the workspace TypeScript version (see "Editor run") |
| 2 | Undoing clears it | PASS: `(none)` | **NOT RUN** |
| 3 | Two siblings with the same name: red squiggle on the second | PASS: `[scene-lint 90001 error] "name: \"Ball\"" "Duplicate sibling name "Ball"."`, start = `lastIndexOf`, not `indexOf` | **PASS (by hand, by the user)**: red squiggle on the duplicate sibling. A first attempt renamed the ROOT to "Ball" (parent and child, not siblings) and correctly showed nothing |
| 4 | Normal TS errors in the same file still show | PASS: `[ts 2820 error] "texture" "Type '"res://art/bal.png"' is not assignable to type 'TexturePath \| undefined'. Did you mean '"res://art/ball.png"'?"` listed together with the scene-lint error | **PASS (by hand, by the user)**: the TypeScript error shows alongside |
| 5 | A child replaced by a function call: single "not statically analyzable" diagnostic, editor keeps working | PASS: one `[scene-lint 90002 warning] "makeWall()" "scene-lint: file is not statically analyzable: child is not an object literal (...)"`, plus the normal `[ts 2304] "makeWall" Cannot find name`; the server answered the next request; restoring cleared it | **PASS (by hand, by the user)**: `makeWall` is red (TypeScript's own "Cannot find name"); hovering the `()` shows scene-lint's warning. Whether typing stayed responsive and whether restoring cleared it were not reported |
| 6 | Deliberate throw inside the plugin: normal TS errors still work; record the log | PASS: TS error still reported, zero scene-lint output. Log line: `Info 62 [21:24:46.987] scene-lint: error while linting <poc4>/sample/level.def.ts, falling back to normal diagnostics: Error: deliberate test failure` (a stack follows it in the log); the server kept answering requests | **PASS (by hand, by the user, log checked by the agent)**: started Cursor with `SCENE_LINT_DEBUG_THROW=1`. Cursor's own tsserver log (`~/.cc-poc4/user/logs/.../tsserver.log`, TypeScript 5.9.3) contains `scene-lint: error while linting .../sample/level.def.ts, falling back to normal diagnostics: Error: deliberate test failure` three times (stack from `proxy.getSemanticDiagnostics`, `plugins/scene-lint/dist/src/index.js:136`). On screen the user confirmed, with "I think so", that the TypeScript error stayed and the scene-lint warning disappeared |
| 7 | Files not matching `*.def.ts` unaffected; editor feels no slower | PASS for "unaffected": `other.ts` gets only `[ts 2322] "answer"`, and the log has no `linted ...other.ts` line. "Feels no slower" is **not established**: see timing below | **NOT RUN by hand** (user chose to stop). Objective part measured on a 4,508-line file: no measurable cost, see "Editor run" item 6 |

Other automated checks that passed: sample file starts with no diagnostics; files on disk never modified; the plugin was loaded by
tsserver (`scene-lint: create` in the log); server answers requests after a function-call child and after a throw.

### Timing (informational, not a verdict)

`other.ts`, 100 iterations of "edit the buffer, request diagnostics", plugin on vs an identical project without the plugin:

```
run 1: plugin on 3.51 ms, plugin off 3.06 ms
run 2: plugin on 2.72 ms, plugin off 3.30 ms
run 3: plugin on 4.65 ms, plugin off 2.89 ms
run 4: plugin on 2.89 ms, plugin off 2.54 ms
```

That is run-to-run noise; no slowdown is visible for non-`.def.ts` files, which is expected because the override returns before doing any work.
I did not measure a large `.def.ts`. Real typing latency in an editor was not measured.

## Probes: where the mapping bends or breaks (informational, in `test/run.mjs`)

| Case | What the plugin reported |
| --- | --- |
| Half-typed child `{ name: "X", ty` | TS's own errors, plus **one** `90002 not statically analyzable` on `ty` (parser recovery turned it into a shorthand property). The validator's findings vanish while typing, then come back. |
| `as const` instead of `satisfies` (+ duplicate name) | Works: duplicate reported |
| Quoted keys `"name": "Ball"` | Works; the squiggle covers `"name": "Ball"` |
| `name` as a template literal without substitutions | Works |
| Spread inside `children` | `90002` on `...[]` |
| No `scene` variable | `90002`, but the squiggle lands on the **first character of the file** (length 1) |
| Root renamed to match its child | `(none)`: correct, a parent and child are not siblings (the probe label in the test says "first child of the root", which is misleading) |

## Findings and surprises

- **The mapping is an identity map, so the validator's contract matters.** `issue.node` must be the very `SceneNode` object the
  plugin built. If the real PoC 3 validator returns paths, copies or ids instead, the plugin needs a different lookup. I guessed
  the stub's signature from the PoC 4 handover text; PoC 3 was not read, so this is the main integration risk.
- **`getProgram()` does reflect unsaved buffers.** Confirmed with `change` requests and unchanged files on disk.
- **TS reports a near-miss string as code 2820, not 2322** ("Did you mean ..."). My first test expected 2322 and failed; fixed the test.
- **Plugin resolution worked with no special flags.** `sample/tsconfig.json` just names `scene-lint`; tsserver found
  `node_modules/scene-lint` by walking up from the tsconfig. With Bun workspaces, the link only exists if something depends on it, so the
  root `package.json` has `"scene-lint": "workspace:*"`. Without that, `bun install` did not create the symlink.
- **Use the `ts` passed into `init`, never `import ts`.** The plugin imports only types from `typescript`, so it always matches the
  server's version. `export = init` compiles to `module.exports = init`, which is what tsserver needs.
- **Only semantic diagnostics are hooked.** Syntax errors come from tsserver as usual.
- **Mid-typing flicker** (see probes) is the most visible rough edge for a real user.
- **Type-only imports in a `.def.ts` are fine** (the sample imports `SceneNode` with `import type`); the plugin only reads the AST of the one file.
- **Unknown keys** in a node literal are ignored by the reader (TypeScript's excess-property check reports them).

## Decisions to review

1. **Stub validator, guessed API.** Two rules only (duplicate sibling names = error; physics bodies / `Area2D` with no collision shape child = warning).
   `validate(root): { node, severity, message }[]`. This must be reconciled with PoC 3 when integrating.
2. **"Imported rather than copied"** is met only loosely: the plugin imports `../stub/validate` (one separate file, compiled into the plugin's `dist`).
   No PoC 3 code was available to import. Replace that import when integrating.
3. **`SceneNode` is a stub** with one extra field (`texture?: TexturePath`) so there is a real PoC 1-style typo error to test with; `registry.stub.ts` stands in for PoC 1's output.
4. **Not-statically-analyzable is a Warning (yellow)**, placed on the offending expression (not the file). The handover says "single diagnostic" but not the category or placement.
5. **Test hook:** `SCENE_LINT_DEBUG_THROW=1` in the tsserver's environment makes the plugin throw. It's read in production code; remove or gate it if you don't want that.
6. **Tests use a real tsserver process** and the tsserver protocol, not a mock.

## Editor run (by hand, in Cursor)

What it took to get the plugin loaded in a real editor, in the order it went wrong:

1. **Only "built-in" or "TypeScript 7" was offered**, no workspace version. The user's global Cursor settings had
   `"typescript.experimental.useTsgo": true`, which turns on TypeScript 7. Cursor then reports
   `TypeScript server plugins from the "ms-vscode.vscode-typescript-tslint-plugin" extension will not be loaded because TypeScript 7 is enabled globally.`
   With TS 7, tsserver plugins do not load at all. The setting is window-scoped, so a workspace setting can override it,
   but in practice the user's normal window kept showing the message.
2. **`.vscode/settings.json` in this folder** now sets `useTsgo` to false, `typescript.tsserver.pluginPaths: ["."]` (verified
   in a simulated tsserver: each probe location D is searched as `D/node_modules/<plugin name>`), and Cursor itself added
   `js/ts.tsdk.path: node_modules/typescript/lib` when the workspace version was selected.
3. **Clean profile.** A separate Cursor profile (no TS 7 setting, none of the user's extensions) was started with
   `Cursor --user-data-dir ~/.cc-poc4/user --extensions-dir ~/.cc-poc4/ext --new-window pocs/poc4-plugin`. It only started
   after the user's own Cursor was closed. The first attempts from inside the agent's scratch folder died with
   `listen EINVAL ... 3.22-main.sock is longer than 103 chars`: the profile path must be short.
4. **Result:** after the user changed the TypeScript version (to the workspace one), the squiggles appeared. The tsserver
   log settles which mechanism loaded the plugin: `Enabling plugin scene-lint from candidate paths: .../typescript/lib/typescript.js/../../..`
   followed by `scene-lint: create`, with `Version: 5.9.3`. That is the default lookup next to the workspace TypeScript, not
   `pluginPaths`. So selecting the workspace TypeScript version is what matters; whether `pluginPaths` would also have
   worked with the built-in TypeScript was not observed in the editor (it worked in a simulated tsserver).
5. **Crash check (criterion 6)** was done in the same clean profile, restarted with `SCENE_LINT_DEBUG_THROW=1` and
   `"typescript.tsserver.log": "verbose"` in that profile's user settings: see the table row.
   To clean up: close that window and delete `~/.cc-poc4`.

6. **Large-file benchmark (criterion 7, objective half).** A generated `sample/large.def.ts` (4,508 lines, about 1,500 nodes:
   500 bodies, each with a shape and a sprite) was opened in a real tsserver (TypeScript 5.9.3) over its stdio protocol,
   then edited 8 times, each edit followed by a diagnostics request. Median per edit plus re-check, two runs each:

   | Case | No plugin | With plugin |
   | --- | --- | --- |
   | valid file | 57-59 ms | 56-57 ms |
   | one duplicate name (plugin reports 1 `scene-lint` diagnostic) | 59-64 ms | 60-64 ms |

   First open and worst edit were also within noise (first 63-67 ms in all cases; max 78-93 ms). The duplicate case proves the
   plugin was active in the timing. Conclusion: no measurable cost at this size. The scripts were scratch files and are not
   in the repo; the large file was deleted afterwards.

Not run by hand in the editor (the user chose to stop here): criterion 2 (undo clears) and the "feels no slower" half of
criterion 7. Criterion 2 passed at the tsserver level only.

## NOT RUN: the remaining editor steps, for you to do by hand

1. `cd pocs/poc4-plugin && bun install && bun run build`.
2. Open the folder `pocs/poc4-plugin` in Cursor/VS Code (so `node_modules/typescript` is at the workspace root).
3. Command palette: "TypeScript: Select TypeScript Version..." -> "Use Workspace Version" (the bundled version will not load the plugin). Then "TypeScript: Restart TS Server".
4. Open `sample/level.def.ts`. It should have no squiggles. Then, without saving:
   - delete the `{ name: "Shape", type: "CollisionShape2D" },` line: a yellow squiggle on `name: "Ball"` (criterion 1); undo: it clears (2);
   - change `name: "Walls"` to `name: "Ball"`: a red squiggle on the second one (3);
   - also change `res://art/ball.png` to `res://art/bal.png`: the TypeScript error shows next to it (4);
   - replace the `Walls` child with `makeWall()`: one "not statically analyzable" warning, editing still works (5).
5. Throw check (6): start the editor from a terminal with the variable set, `SCENE_LINT_DEBUG_THROW=1 cursor pocs/poc4-plugin`, restart the TS server, and confirm TypeScript errors still appear. Logs need `"typescript.tsserver.log": "verbose"` in settings, then "TypeScript: Open TS Server log".
6. Feel (7): type in `other.ts` and in a large `.def.ts` and see if it lags.

## Next steps

- Reconcile the validator contract with PoC 3 (identity of `issue.node`, severity names).
- Decide whether to suppress the "not statically analyzable" warning while a literal is mid-edit (flicker).
- Give the no-`scene` case a better squiggle position than the first character.
- Run the editor checks above, then record results here.

## Rework (2026-09-30): real validator, shared type, tolerant reader

What changed and why: the first version called a two-rule stub, read a top-level `texture` field that the real scene type does
not have, and gave up on the whole file at the first call, spread or variable. Real definitions (Pong's `paddle(...)`, Breakout's
loops and helpers) are full of those, so it would have been silent on almost everything.

- **Real validator.** The validator's core was made pure (`tools/validate-core.ts`: no Node APIs, no `import.meta`; the class data is a
  JSON import; the CLI moved to `validate-scene.ts`, which re-exports the core). The plugin imports it and is bundled with Bun into one
  CommonJS file (`plugins/scene-lint/dist`, 92 KB, validator and class data included) because tsserver loads plugins with `require`.
  Validator: still 44 of 44 tests.
- **Shared scene type** (`packages/scene`). The reader builds that type from the AST: `name`, `type`, `script`, the keys of `props` and
  `scriptProps`, `children`. The stub files are gone.
- **Tolerant reader.** A node whose `name` or `type` is not a plain string is *opaque* and left out. A call, spread or variable among the
  `children`, or a spread in `props`, is a *gap* on that node. Rules that would be wrong with a gap are silenced for that node only
  (`body-needs-shape` when children have a gap; `shape-needs-shape-prop` and `sprite-needs-texture` when props have a gap). Everything
  literal is still checked. Only a root that is not a literal (`const scene = build()`) still gives the "not statically analyzable" warning.
- **Tests** (real tsserver, `bun run test`): the earlier 16, updated (a call is now opaque, not a reason to give up), plus 5 new ones on
  `sample/helpers.def.ts` (helper calls, a variable, a spread and a script constant give no false positives; a class typo in a literal
  node; removing the only helper call brings the missing-shape warning back; script variables without a script; duplicate names
  beside opaque siblings). Result: ALL CHECKS PASSED.
- **Real files** (`node test/check-file.mjs <folder> <file> [--edit from to]`, prints what the editor would show): the game repo's
  `pong.def.ts` and `breakout.def.ts` give 0 scene-lint diagnostics (no false positives). With unsaved mistakes in their literal parts the
  plugin reports them: a class typo, a Resource used as a node, duplicate sibling names, script variables with no script. A typo inside
  a helper function (`brick`) is invisible to the plugin; TypeScript still reports it, and the build's validator checks the whole tree.

Limits, honestly: in a definition like Breakout's most nodes are made by helpers, so the plugin sees only the literal skeleton
(camera, HUD, timer, containers). The build (`npm run build`) is where the whole tree is validated. The plugin is live feedback, not the gate.

Not verified: any of this **in the Cursor editor** (only tsserver and the tool above), the old criteria 2 and 7 in an editor, speed on a
scene file with many literal nodes, TypeScript other than 5.9.3.
