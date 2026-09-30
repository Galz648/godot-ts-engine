// scene-lint: a tsserver plugin. On every diagnostics request for a *.def.ts file it reads the `scene` object literal
// from the AST (it never runs the file), runs the real validator, and adds one diagnostic per issue, placed on the
// `name` of the node it is about.
//
// Real definitions are built with helper functions, loops and spreads. The reader does not give up on those: anything it
// cannot read (a call, a variable, a spread) is OPAQUE. Opaque nodes are left out of the tree, and the rules that would
// be wrong without them are silenced for the node that has a gap (see SILENCED). Everything literal is still checked.

import type * as tsModule from "typescript/lib/tsserverlibrary";
import type { SceneNode } from "../../../../scene/src/index.ts";
import { validate } from "../../../../validator/tools/validate-core.ts";

const DEF_SUFFIX = ".def.ts";
const SOURCE = "scene-lint";
const CODE_ISSUE = 90001;
const CODE_NOT_STATIC = 90002;

declare const process: { env: Record<string, string | undefined> };

/** What the reader could not see on one node. */
type Gaps = { children: boolean; props: boolean };

/** A rule is wrong when what it looks at has a gap, so its findings are dropped for that node. */
const SILENCED: Record<string, keyof Gaps> = {
  "body-needs-shape": "children", //          a helper call might be the shape
  "shape-needs-shape-prop": "props", //       the shape might be inside a spread
  "sprite-needs-texture": "props", //         so might the texture
};

/** Thrown when the `scene` itself (the root) cannot be read. `at` is where to put the squiggle. */
class NotStatic extends Error {
  constructor(readonly at: tsModule.Node, message: string) {
    super(message);
  }
}

function init(modules: { typescript: typeof tsModule }) {
  // Use the `ts` tsserver hands us, not our own import, so versions always match.
  const ts = modules.typescript;

  // ---- 1. AST -> shared SceneNode, remembering which object literal each node came from --------------

  function readTree(sourceFile: tsModule.SourceFile) {
    const literals = new Map<SceneNode, tsModule.ObjectLiteralExpression>();
    const gaps = new Map<SceneNode, Gaps>();

    const textOf = (e: tsModule.Expression): string | null =>
      ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : null;

    const keyOf = (p: tsModule.ObjectLiteralElementLike): string | null =>
      ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;

    /** The keys of an object literal (values are not needed by any rule), or null if anything in it is not a plain key. */
    const keysOf = (e: tsModule.Expression): Record<string, true> | null => {
      if (!ts.isObjectLiteralExpression(e)) return null;
      const keys: Record<string, true> = {};
      for (const p of e.properties) {
        const k = keyOf(p);
        if (k === null) return null; // spread, shorthand, method, computed key
        keys[k] = true;
      }
      return keys;
    };

    /** A node, or null if its name or type is not a plain string (then it is opaque and left out). */
    const readNode = (obj: tsModule.ObjectLiteralExpression): SceneNode | null => {
      const node: SceneNode = { name: "", type: "" };
      const gap: Gaps = { children: false, props: false };
      let hasName = false;
      let hasType = false;
      let opaque = false;

      for (const p of obj.properties) {
        const key = keyOf(p);
        if (key === null) { gap.children = true; gap.props = true; continue; } // a spread may add anything
        const value = (p as tsModule.PropertyAssignment).initializer;
        switch (key) {
          case "name": { const t = textOf(value); if (t === null) opaque = true; else { node.name = t; hasName = true; } break; }
          case "type": { const t = textOf(value); if (t === null) opaque = true; else { node.type = t; hasType = true; } break; }
          case "script": node.script = textOf(value) ?? "<dynamic>"; break; // only its presence matters to the rules
          case "props": { const k = keysOf(value); if (k) node.props = k; else gap.props = true; break; }
          case "scriptProps": node.scriptProps = keysOf(value) ?? { "<dynamic>": true }; break;
          case "children": {
            if (!ts.isArrayLiteralExpression(value)) { gap.children = true; break; }
            const kids: SceneNode[] = [];
            for (const el of value.elements) {
              const kid = ts.isObjectLiteralExpression(el) ? readNode(el) : null;
              if (kid) kids.push(kid); else gap.children = true; // a call, a spread, a variable
            }
            node.children = kids;
            break;
          }
          // any other key is ignored here; TypeScript's own excess-property check reports unknown keys
        }
      }
      if (opaque || !hasName || !hasType) return null;
      literals.set(node, obj);
      gaps.set(node, gap);
      return node;
    };

    // find `const scene = <literal> [satisfies X | as X]`
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== "scene" || !decl.initializer) continue;
        let expr: tsModule.Expression = decl.initializer;
        while (ts.isSatisfiesExpression(expr) || ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr)) expr = expr.expression;
        if (!ts.isObjectLiteralExpression(expr)) throw new NotStatic(expr, "`scene` must be an object literal (a call or a variable cannot be analyzed)");
        const root = readNode(expr);
        if (!root) throw new NotStatic(expr, "the root needs a plain string `name` and `type`");
        return { root, literals, gaps };
      }
    }
    throw new NotStatic(sourceFile, "no `const scene = { ... }` found");
  }

  // ---- 2. diagnostics for one file ------------------------------------------------------------------

  function lint(sourceFile: tsModule.SourceFile): tsModule.Diagnostic[] {
    const diagnostic = (start: number, length: number, message: string, category: tsModule.DiagnosticCategory, code: number) =>
      ({ file: sourceFile, start, length, messageText: message, category, code, source: SOURCE }) as tsModule.Diagnostic;

    let tree: ReturnType<typeof readTree>;
    try {
      tree = readTree(sourceFile);
    } catch (e) {
      if (!(e instanceof NotStatic)) throw e;
      const start = e.at === sourceFile ? 0 : e.at.getStart(sourceFile);
      const length = e.at === sourceFile ? Math.min(1, sourceFile.text.length) : e.at.getEnd() - start;
      return [diagnostic(start, length, `scene-lint: file is not statically analyzable: ${e.message}`, ts.DiagnosticCategory.Warning, CODE_NOT_STATIC)];
    }

    const out: tsModule.Diagnostic[] = [];
    for (const issue of validate(tree.root)) {
      const gapKey = SILENCED[issue.rule];
      if (gapKey && tree.gaps.get(issue.node)?.[gapKey]) continue; // the reader could not see what this rule needs
      const literal = tree.literals.get(issue.node);
      if (!literal) continue;
      // the `name: "..."` property of that literal; fall back to the literal's first character
      const nameProp = literal.properties.find((p) => ts.isPropertyAssignment(p) && keyText(p) === "name");
      const start = (nameProp ?? literal).getStart(sourceFile);
      const length = nameProp ? nameProp.getEnd() - start : 1;
      const category = issue.severity === "error" ? ts.DiagnosticCategory.Error : ts.DiagnosticCategory.Warning;
      out.push(diagnostic(start, length, issue.message, category, CODE_ISSUE));
    }
    return out;
  }

  function keyText(p: tsModule.ObjectLiteralElementLike): string | null {
    return ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
  }

  // ---- 3. the plugin: a proxy that passes everything through and adds to getSemanticDiagnostics -----

  function create(info: tsModule.server.PluginCreateInfo): tsModule.LanguageService {
    const log = (msg: string) => info.project.projectService.logger.info(`${SOURCE}: ${msg}`);
    const inner = info.languageService;
    log("create");

    const proxy = Object.create(null) as tsModule.LanguageService;
    for (const key of Object.keys(inner) as (keyof tsModule.LanguageService)[]) {
      const original = inner[key] as (...args: unknown[]) => unknown;
      (proxy as any)[key] = (...args: unknown[]) => original.apply(inner, args);
    }

    proxy.getSemanticDiagnostics = (fileName) => {
      const normal = inner.getSemanticDiagnostics(fileName); // always computed first, always kept
      if (!fileName.endsWith(DEF_SUFFIX)) return normal;
      try {
        if (process.env.SCENE_LINT_DEBUG_THROW) throw new Error("deliberate test failure");
        const sourceFile = inner.getProgram()?.getSourceFile(fileName); // reflects unsaved editor buffers
        if (!sourceFile) return normal;
        const extra = lint(sourceFile);
        log(`linted ${fileName}: ${extra.length} diagnostic(s)`);
        return [...normal, ...extra];
      } catch (e) {
        log(`error while linting ${fileName}, falling back to normal diagnostics: ${(e as Error).stack ?? e}`);
        return normal;
      }
    };

    return proxy;
  }

  return { create };
}

export default init;
