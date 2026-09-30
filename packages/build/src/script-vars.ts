// Checks a definition's two property bags against the node's script, read from the generated .gd file. The validator
// cannot do this (it sees only the tree): a script variable in `props` is written before the `script` line, and Godot
// drops it without a word (found in the Pong proof); a `scriptProps` key the script does not declare does nothing.
import { exists } from "../../validator/tools/classes.ts";
import type { SceneNode } from "../../scene/src/index.ts";

export type VarIssue = { severity: "error" | "warning"; rule: string; path: string; message: string };

/** Member variables of a GDScript file (top-level `var`, with or without annotations), and what it extends. */
export function readScript(gd: string): { vars: Set<string>; extends: string | null } {
  const vars = new Set<string>();
  for (const m of gd.matchAll(/^(?:@\w+(?:\([^)\n]*\))?\s+)*(?:static\s+)?var\s+([A-Za-z_]\w*)/gm)) vars.add(m[1]!);
  return { vars, extends: gd.match(/^extends\s+(\S+)/m)?.[1] ?? null };
}

/** `load` gets a `res://` path and returns the file's text, or null when it cannot be read (then the node is skipped). */
export function checkScriptVars(root: SceneNode, load: (resPath: string) => string | null): VarIssue[] {
  const out: VarIssue[] = [];
  const walk = (n: SceneNode, path: string) => {
    const text = n.script?.startsWith("res://") ? load(n.script) : null;
    if (text !== null) {
      const { vars, extends: base } = readScript(text);
      const file = n.script!.slice("res://".length);
      for (const k of Object.keys(n.props ?? {})) {
        if (vars.has(k)) out.push({ severity: "error", rule: "script-var-in-props", path, message:
          `"${k}" is a variable of ${file}, so it belongs in scriptProps. In props it is written before the script is attached, and Godot drops it silently.` });
      }
      // a script extending another script inherits variables we did not read
      if (base !== null && exists(base)) {
        for (const k of Object.keys(n.scriptProps ?? {})) {
          if (!vars.has(k)) out.push({ severity: "warning", rule: "script-prop-unknown", path, message:
            `"${k}" is not a variable of ${file}. If it is a property of ${n.type} itself, move it to props.` });
        }
      }
    }
    for (const c of n.children ?? []) walk(c, path === "." ? c.name : `${path}/${c.name}`);
  };
  walk(root, ".");
  return out;
}
