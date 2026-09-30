import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { emitTscn } from "../../emitter/tools/emit-tscn.ts";
import type { SceneNode } from "../../scene/src/index.ts";
import { diffTrees } from "./diff.ts";
import { parseTscn } from "./parse.ts";
import { writeDef } from "./write-def.ts";

const registry = {
  Scripts: { ball: "res://scripts/ball.gd", "odd-key": "res://scripts/odd.gd" },
  Textures: { ball: "res://art/ball.png" },
};

const tree: SceneNode = {
  name: "Level",
  type: "Node2D",
  script: "res://scripts/odd.gd",
  children: [
    {
      name: "Ball",
      type: "CharacterBody2D",
      script: "res://scripts/ball.gd",
      props: { position: { raw: "Vector2(64, 64)" }, visible: false, "collision/layer": 2 },
      scriptProps: { speed: 420.5, label: 'say "hi"' },
      children: [
        { name: "Sprite", type: "Sprite2D", props: { texture: { ext: "res://art/ball.png" } } },
        { name: "Unknown", type: "Sprite2D", props: { texture: { ext: "res://art/not-in-registry.png" } } },
        { name: "Shape", type: "CollisionShape2D", props: { shape: { sub: { type: "CircleShape2D", props: { radius: 8 } } } } },
      ],
    },
  ],
};

/** Writes the definition next to a registry file, imports it, and returns the tree and the source. */
async function load(source: string): Promise<SceneNode> {
  const dir = mkdtempSync(join(tmpdir(), "write-def-"));
  writeFileSync(join(dir, "registry.gen.ts"), `export const Scripts = ${JSON.stringify(registry.Scripts)} as const;\nexport const Textures = ${JSON.stringify(registry.Textures)} as const;\nexport type ScriptPath = string; export type TexturePath = string;\n`);
  writeFileSync(join(dir, "x.def.ts"), source);
  const mod = await import(pathToFileURL(join(dir, "x.def.ts")).href);
  rmSync(dir, { recursive: true, force: true });
  return mod.default;
}

test("a written definition imports back as the same tree, and exports its output", async () => {
  const source = writeDef(tree, { output: "scenes/level.tscn", registry, header: ["pulled for a test"] });
  expect(await load(source)).toEqual(tree);
  expect(source).toContain('export const output = "scenes/level.tscn";');
  expect(source.startsWith("// pulled for a test\n")).toBe(true);
});

test("known paths become registry keys; unknown ones stay strings (so TypeScript can flag them)", () => {
  const source = writeDef(tree, { output: "x.tscn", registry });
  expect(source).toContain("script: Scripts.ball,");
  expect(source).toContain('script: Scripts["odd-key"],');
  expect(source).toContain("{ ext: Textures.ball }");
  expect(source).toContain('{ ext: "res://art/not-in-registry.png" }');
});

test("a scene saved by the Godot editor becomes a definition that emits the same scene", async () => {
  const saved = parseTscn(readFileSync(new URL("../measure/editor-hand-save.tscn", import.meta.url), "utf8"));
  const back = await load(writeDef(saved.root, { output: "x.tscn" }));
  expect(emitTscn(back)).toBe(emitTscn(saved.root));
});

test("diff: says what changed, and nothing when the trees match", () => {
  expect(diffTrees(tree, structuredClone(tree))).toEqual([]);
  const edited = structuredClone(tree);
  edited.children![0]!.props!.visible = true;
  edited.children![0]!.props!.position = { raw: "Vector2(10, 64)" };
  edited.children![0]!.scriptProps!.speed = 300;
  edited.children![0]!.children!.pop();
  edited.children!.push({ name: "Timer", type: "Timer" });
  expect(diffTrees(tree, edited)).toEqual([
    "Ball: position Vector2(64, 64) -> Vector2(10, 64)",
    "Ball: visible false -> true",
    "Ball: script variable speed 420.5 -> 300",
    "+ Timer (Timer)",
    "- Ball/Shape",
  ]);
});
