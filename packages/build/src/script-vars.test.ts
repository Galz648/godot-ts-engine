import { expect, test } from "bun:test";
import { checkScriptVars, readScript } from "./script-vars.ts";

// what tstogd writes for src/scripts/coin.ts
const COIN = `class_name Coin
extends Area2D

@export
var value: int = 1
@export_range(0, 10) var tier: int = 0
@onready var sprite: Sprite2D = $Sprite
static var count = 0
signal collected(value: int)

func _ready() -> void:
	var local := 3
`;
const files: Record<string, string> = { "res://scripts/coin.gd": COIN, "res://scripts/gold.gd": "extends Coin\nvar shine = 1\n" };
const load = (p: string) => files[p] ?? null;

test("reads member variables (annotated or not, static) but not locals; and the base class", () => {
  const s = readScript(COIN);
  expect([...s.vars].sort()).toEqual(["count", "sprite", "tier", "value"]);
  expect(s.extends).toBe("Area2D");
});

test("a script variable in props is an error; in scriptProps it is fine", () => {
  const issues = checkScriptVars({ name: "Main", type: "Node2D", children: [
    { name: "Coin", type: "Area2D", script: "res://scripts/coin.gd", props: { position: { raw: "Vector2(1, 2)" }, value: 5 } },
    { name: "Ok", type: "Area2D", script: "res://scripts/coin.gd", scriptProps: { value: 5, tier: 2 } },
  ] }, load);
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ severity: "error", rule: "script-var-in-props", path: "Coin" });
  expect(issues[0]!.message).toContain('"value" is a variable of scripts/coin.gd, so it belongs in scriptProps');
});

test("a scriptProps key the script does not declare is a warning, unless the script extends another script", () => {
  const issues = checkScriptVars({ name: "Coin", type: "Area2D", script: "res://scripts/coin.gd", scriptProps: { valu: 5 }, children: [
    { name: "Gold", type: "Area2D", script: "res://scripts/gold.gd", scriptProps: { value: 9 } },
  ] }, load);
  expect(issues).toEqual([{ severity: "warning", rule: "script-prop-unknown", path: ".", message: expect.stringContaining('"valu" is not a variable of scripts/coin.gd') }]);
});

test("a script that cannot be read is skipped", () => {
  expect(checkScriptVars({ name: "X", type: "Node2D", script: "res://scripts/missing.gd", props: { value: 1 } }, load)).toEqual([]);
});
