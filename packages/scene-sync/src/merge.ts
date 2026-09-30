// Three-way merge of scene trees: `base` is what the tool last wrote, `ours` is the new tree from TypeScript, `theirs` is
// what the Godot editor saved. Nodes are identified by their path, so a rename looks like a delete plus an add (a known limit).
import type { PropValue, SceneNode } from "../../scene/src/index.ts";

export type Conflict = { path: string; what: string };
type Flat = { type: string; script?: string; props?: Record<string, PropValue>; scriptProps?: Record<string, PropValue>; children: string[] };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const strip = (f: Flat) => ({ type: f.type, script: f.script, props: f.props, scriptProps: f.scriptProps });

export function flatten(root: SceneNode): Map<string, Flat> {
  const out = new Map<string, Flat>();
  const walk = (n: SceneNode, path: string) => {
    out.set(path, { type: n.type, script: n.script, props: n.props, scriptProps: n.scriptProps, children: (n.children ?? []).map((c) => c.name) });
    for (const c of n.children ?? []) walk(c, path === "." ? c.name : `${path}/${c.name}`);
  };
  walk(root, ".");
  return out;
}

export function merge3(base: SceneNode, ours: SceneNode, theirs: SceneNode): { merged: SceneNode; conflicts: Conflict[] } {
  const B = flatten(base), O = flatten(ours), T = flatten(theirs);
  const conflicts: Conflict[] = [];

  /** One value, three versions: a change on one side wins; the same change on both is fine; different changes conflict (ours wins). */
  const pick = <V>(path: string, what: string, b: V | undefined, o: V | undefined, t: V | undefined): V | undefined => {
    if (same(o, t)) return o;
    if (same(o, b)) return t;
    if (same(t, b)) return o;
    conflicts.push({ path, what: `${what}: changed in both TypeScript and Godot; TypeScript's value kept` });
    return o;
  };
  const pickBag = (path: string, label: string, b?: Record<string, PropValue>, o?: Record<string, PropValue>, t?: Record<string, PropValue>) => {
    const out: Record<string, PropValue> = {};
    for (const k of new Set([...Object.keys(b ?? {}), ...Object.keys(o ?? {}), ...Object.keys(t ?? {})])) {
      const v = pick(path, `${label} "${k}"`, b?.[k], o?.[k], t?.[k]);
      if (v !== undefined) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  };

  const kept = new Map<string, Flat>();
  for (const p of new Set([...B.keys(), ...O.keys(), ...T.keys()])) {
    const b = B.get(p), o = O.get(p), t = T.get(p);
    if (o && t) {
      kept.set(p, {
        type: pick(p, "class", b?.type, o.type, t.type)!,
        script: pick(p, "script", b?.script, o.script, t.script),
        props: pickBag(p, "property", b?.props, o.props, t.props),
        scriptProps: pickBag(p, "script variable", b?.scriptProps, o.scriptProps, t.scriptProps),
        children: [],
      });
    } else if (o || t) {
      const side = (o ?? t)!, who = o ? "TypeScript" : "Godot", other = o ? "Godot" : "TypeScript";
      if (!b) kept.set(p, side); //                                                     added on one side
      else if (!same(strip(side), strip(b))) { //                                       deleted on one side, changed on the other
        conflicts.push({ path: p, what: `deleted in ${other} but changed in ${who}; the node was kept` });
        kept.set(p, side);
      } // else: deleted on one side and untouched on the other: it is gone
    }
  }

  // rebuild the tree: children in TypeScript's order, then the ones only Godot has
  const placed = new Set<string>();
  const build = (path: string, name: string): SceneNode => {
    placed.add(path);
    const f = kept.get(path)!;
    const node: SceneNode = { name, type: f.type };
    if (f.script !== undefined) node.script = f.script;
    if (f.props) node.props = f.props;
    if (f.scriptProps) node.scriptProps = f.scriptProps;
    const names = [...new Set([...(O.get(path)?.children ?? []), ...(T.get(path)?.children ?? []), ...(B.get(path)?.children ?? [])])];
    const kids = names.filter((n) => kept.has(path === "." ? n : `${path}/${n}`)).map((n) => build(path === "." ? n : `${path}/${n}`, n));
    if (kids.length) node.children = kids;
    return node;
  };
  const merged = build(".", ours.name);
  for (const p of kept.keys()) if (!placed.has(p)) conflicts.push({ path: p, what: "its parent was deleted, so the node was dropped" });
  return { merged, conflicts };
}
