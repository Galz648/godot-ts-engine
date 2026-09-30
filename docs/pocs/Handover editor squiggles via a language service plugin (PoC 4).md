# Handover: editor squiggles via a language service plugin (PoC 4)

Sep 30, 2026 · @HUMONGOUSCOCKOUS

## Context and goal

Build a TypeScript language service plugin that runs the PoC 3 validator on a scene definition file and shows each issue as a red or yellow squiggle on the offending node, live, before saving. This is the same technique tstogd uses to surface its converter errors.

This is the fourth and last proof of concept. A language service plugin wraps the TypeScript server the editor already talks to: it passes normal requests through and appends its own diagnostics to `getSemanticDiagnostics`.

The hard part is not running the validator but mapping each issue back to a character range in the source. The goal is to learn exactly how that mapping works and where it breaks.

## Scope and constraints

In scope:

- A plugin package, e.g. `plugins/scene-lint`, registered in the sample project's tsconfig.json under `compilerOptions.plugins`.
- Only files matching `*.def.ts`, containing one tree written as a plain object literal: `export const scene = { … } satisfies SceneNode`.
- Converting that object literal AST into SceneNode data, while recording which AST node each SceneNode came from.
- Running `validate()` and returning one diagnostic per issue, placed on the node's `name` property.

Out of scope:

- Trees built with functions, spreads, variables or imports. For those, return one diagnostic saying the file isn't statically analyzable.
- Executing the user's file. The plugin reads the AST only.
- Code fixes, hover text or completions.
- tsc on the command line: plugins only run in the editor. The PoC 3 CLI covers builds.

Constraints: CommonJS output (tsserver loads plugins with require), the validator imported rather than copied, time-boxed to about three hours. Write SESSION.md with intent, tasks, completed work, findings and next steps.

## Deliverables and how it works

Deliver `plugins/scene-lint/src/index.ts`, its package.json, the sample tsconfig.json wiring, and SESSION.md.

The plugin does this on every diagnostics request:

1. tsserver calls the plugin's `create(info)`; the plugin returns a proxy of `info.languageService` with every method passed through.
2. The proxy overrides `getSemanticDiagnostics(fileName)`: it gets the normal diagnostics first and keeps them.
3. If the file matches `*.def.ts`, it gets the source file from `info.languageService.getProgram()`, which reflects unsaved editor buffers.
4. It finds the `scene` object literal and walks it, building SceneNode data plus a `Map<SceneNode, ts.ObjectLiteralExpression>`.
5. It runs `validate()`; for each issue it looks up `issue.node` in the map, then finds that literal's `name` property.
6. It returns the original diagnostics plus one `ts.Diagnostic` per issue: `start` and `length` from the `name` property, `category` Error or Warning by severity, and a fixed custom `code` (e.g. 90001) plus `source: "scene-lint"`.

Setup notes for the agent:

- In VS Code, the workspace must use its own TypeScript version, not the bundled one, or the plugin won't load.
- After rebuilding the plugin, restart the TS server. Enable logging with the `TSS_LOG` environment variable and log through `info.project.projectService.logger`.
- Wrap the whole override in try/catch and fall back to the original diagnostics: a crash here silently kills all TypeScript errors in the editor.

## Acceptance criteria

Done means each check works by hand in the editor, with what actually happened recorded in SESSION.md.

- [ ] Deleting the CollisionShape2D from the Ball node puts a yellow squiggle on `name: "Ball"` without saving the file.
- [ ] Undoing the change clears the squiggle.
- [ ] Giving two siblings the same name puts a red squiggle on the second one.
- [ ] Normal TypeScript errors in the same file (e.g. a misspelled texture path from PoC 1) still show alongside.
- [ ] Replacing a child with a function call shows the single "not statically analyzable" diagnostic, and the editor keeps working.
- [ ] Throwing deliberately inside the plugin leaves normal TypeScript errors working. Record what the log shows.
- [ ] Files not matching `*.def.ts` are unaffected, and the editor feels no slower.
