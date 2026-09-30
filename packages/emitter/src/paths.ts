// Hand-written stand-in for the ScriptPath / TexturePath types that PoC 1's registry.gen.ts generates.
// ghost.gd is listed on purpose: a path the registry knows about whose file was never compiled.
export type ScriptPath = "res://scripts/ball.gd" | "res://scripts/ghost.gd";
export type TexturePath = "res://art/ball.png" | "res://art/paddle.png";
