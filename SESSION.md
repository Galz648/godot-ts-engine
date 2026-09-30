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
- **Every acceptance criterion was verified at the tsserver level, none was verified in Cursor/VS Code.** See the table.

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
| 1 | Deleting the CollisionShape2D from Ball puts a yellow squiggle on `name: "Ball"` without saving | PASS: `[scene-lint 90001 warning] "name: \"Ball\"" "CharacterBody2D "Ball" has no CollisionShape2D or CollisionPolygon2D child, so it cannot collide."`, span start = first `name: "Ball"` | **NOT RUN** |
| 2 | Undoing clears it | PASS: `(none)` | **NOT RUN** |
| 3 | Two siblings with the same name: red squiggle on the second | PASS: `[scene-lint 90001 error] "name: \"Ball\"" "Duplicate sibling name "Ball"."`, start = `lastIndexOf`, not `indexOf` | **NOT RUN** |
| 4 | Normal TS errors in the same file still show | PASS: `[ts 2820 error] "texture" "Type '"res://art/bal.png"' is not assignable to type 'TexturePath \| undefined'. Did you mean '"res://art/ball.png"'?"` listed together with the scene-lint error | **NOT RUN** |
| 5 | A child replaced by a function call: single "not statically analyzable" diagnostic, editor keeps working | PASS: one `[scene-lint 90002 warning] "makeWall()" "scene-lint: file is not statically analyzable: child is not an object literal (...)"`, plus the normal `[ts 2304] "makeWall" Cannot find name`; the server answered the next request; restoring cleared it | **NOT RUN** |
| 6 | Deliberate throw inside the plugin: normal TS errors still work; record the log | PASS: TS error still reported, zero scene-lint output. Log line: `Info 62 [21:24:46.987] scene-lint: error while linting <poc4>/sample/level.def.ts, falling back to normal diagnostics: Error: deliberate test failure` (a stack follows it in the log); the server kept answering requests | **NOT RUN** |
| 7 | Files not matching `*.def.ts` unaffected; editor feels no slower | PASS for "unaffected": `other.ts` gets only `[ts 2322] "answer"`, and the log has no `linted ...other.ts` line. "Feels no slower" is **not established**: see timing below | **NOT RUN** |

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

## NOT RUN: the editor checks, for you to do by hand

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
