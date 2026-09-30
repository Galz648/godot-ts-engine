// Command line for the validator. The rules and the walk are in validate-core.ts; this file re-exports them so existing
// imports keep working.
//
// CLI:  node tools/validate-scene.ts <tree-file.ts>     (the file's default export is the root SceneNode)
//       bun  tools/validate-scene.ts <tree-file.ts>

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validate } from "./validate-core.ts";
import type { AnySceneNode as SceneNode } from "./scene-node.ts";

export * from "./validate-core.ts";

// ---- CLI -----------------------------------------------------------------------------------------

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node tools/validate-scene.ts <tree-file.ts>   (default export = the root SceneNode)");
    process.exit(2);
  }

  let tree: SceneNode;
  try {
    tree = (await import(pathToFileURL(resolve(file)).href)).default;
  } catch (err) {
    console.error(`could not load ${file}: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }

  const issues = validate(tree);
  for (const i of issues) console.log(`${i.severity}: ${i.path}: ${i.message}`);
  const errors = issues.filter((i) => i.severity === "error").length;
  console.log(issues.length === 0 ? "ok: no issues" : `${errors} error(s), ${issues.length - errors} warning(s)`);
  process.exit(errors > 0 ? 1 : 0);
}
