// scene-lint: a tsserver plugin. On every diagnostics request for a *.def.ts file it reads the
// `scene` object literal from the AST (never executes the file), runs the validator, and adds one
// diagnostic per issue, placed on that node's `name` property.

import type * as tsModule from "typescript/lib/tsserverlibrary";
import { validate } from "../stub/validate";
import type { SceneNode } from "../stub/types";

const DEF_SUFFIX = ".def.ts";
const SOURCE = "scene-lint";
const CODE_ISSUE = 90001;
const CODE_NOT_STATIC = 90002;

declare const process: { env: Record<string, string | undefined> };

/** Thrown while reading the AST when the tree is not a plain object literal. `at` is where to put the squiggle. */
class NotStatic extends Error {
  constructor(readonly at: tsModule.Node, message: string) {
    super(message);
  }
}

function init(modules: { typescript: typeof tsModule }) {
  // Use the `ts` tsserver hands us, not our own import, so versions always match.
  const ts = modules.typescript;

  // ---- 1. AST -> SceneNode data, remembering which object literal each node came from -----------

  function readTree(sourceFile: tsModule.SourceFile) {
    const literals = new Map<SceneNode, tsModule.ObjectLiteralExpression>();

    const text = (expr: tsModule.Expression): string => {
      if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
      throw new NotStatic(expr, "expected a plain string literal");
    };

    const keyOf = (prop: tsModule.PropertyAssignment): string => {
      if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) return prop.name.text;
      throw new NotStatic(prop.name, "computed property names cannot be analyzed");
    };

    const readNode = (obj: tsModule.ObjectLiteralExpression): SceneNode => {
      const node: SceneNode = { name: "", type: "" };
      let hasName = false;
      let hasType = false;

      for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) {
          throw new NotStatic(prop, "only plain `key: value` properties can be analyzed (no spread, shorthand or methods)");
        }
        switch (keyOf(prop)) {
          case "name":
            node.name = text(prop.initializer);
            hasName = true;
            break;
          case "type":
            node.type = text(prop.initializer);
            hasType = true;
            break;
          case "script":
            node.script = text(prop.initializer);
            break;
          case "texture":
            node.texture = text(prop.initializer) as SceneNode["texture"];
            break;
          case "children": {
            if (!ts.isArrayLiteralExpression(prop.initializer)) {
              throw new NotStatic(prop.initializer, "`children` must be an array literal");
            }
            node.children = prop.initializer.elements.map((el) => {
              if (!ts.isObjectLiteralExpression(el)) {
                throw new NotStatic(el, "child is not an object literal (calls, spreads and variables cannot be analyzed)");
              }
              return readNode(el);
            });
            break;
          }
          // any other key: ignored here; TypeScript's own excess-property check reports unknown keys
        }
      }

      if (!hasName) throw new NotStatic(obj, "node has no string `name` property");
      if (!hasType) throw new NotStatic(obj, "node has no string `type` property");
      literals.set(node, obj);
      return node;
    };

    // find `const scene = <literal> [satisfies X | as X]`
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== "scene" || !decl.initializer) continue;
        let expr: tsModule.Expression = decl.initializer;
        while (ts.isSatisfiesExpression(expr) || ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr)) {
          expr = expr.expression;
        }
        if (!ts.isObjectLiteralExpression(expr)) throw new NotStatic(expr, "`scene` must be an object literal");
        return { root: readNode(expr), literals };
      }
    }
    throw new NotStatic(sourceFile, "no `export const scene = { ... }` found");
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

    return validate(tree.root).map((issue) => {
      const literal = tree.literals.get(issue.node)!;
      // the `name: "..."` property of that literal; fall back to the whole literal's first character
      const nameProp = literal.properties.find(
        (p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === "name",
      );
      const start = (nameProp ?? literal).getStart(sourceFile);
      const length = nameProp ? nameProp.getEnd() - start : 1;
      const category = issue.severity === "error" ? ts.DiagnosticCategory.Error : ts.DiagnosticCategory.Warning;
      return diagnostic(start, length, issue.message, category, CODE_ISSUE);
    });
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

export = init;
