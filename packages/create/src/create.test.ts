import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, slugOf, writeTemplate } from "./create.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "create-test-"));

test("writes every template file with the name filled in", () => {
  const dir = join(tmp(), "space-game");
  const files = writeTemplate(dir, "Space Game");
  for (const f of ["project.godot", "package.json", "tstogd.json", ".gitignore", "AGENTS.md", "scene-defs/main.def.ts", "src/scripts/player.ts", "src/scripts/coin.ts", "src/scripts/main.ts", "art/player.svg", "art/coin.svg", "tests/smoke.gd", "tools/cursor-profile/launch.sh"]) {
    expect(files).toContain(f);
  }
  expect(files).not.toContain("gitignore");
  for (const f of files) expect(readFileSync(join(dir, f), "utf8")).not.toMatch(/\{\{\w+\}\}/);
  expect(readFileSync(join(dir, "project.godot"), "utf8")).toContain('config/name="Space Game"');
  expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name).toBe("space-game");
  expect(statSync(join(dir, "tools/cursor-profile/launch.sh")).mode & 0o111).toBeTruthy();
  rmSync(dir, { recursive: true, force: true });
});

test("refuses a folder that is not empty", () => {
  const dir = tmp();
  writeFileSync(join(dir, "keep.txt"), "mine");
  expect(() => writeTemplate(dir, "x")).toThrow("not empty");
  expect(existsSync(join(dir, "project.godot"))).toBe(false);
  rmSync(dir, { recursive: true, force: true });
});

test("names: slug, default from the folder, and rejects characters that would break the files", () => {
  expect(slugOf("My Cool_Game 2")).toBe("my-cool-game-2");
  expect(parseArgs(["/tmp/rocket-run"]).name).toBe("rocket-run");
  expect(() => parseArgs(["/tmp/x", "--name", 'Bad "quote"'])).toThrow("use letters");
  expect(() => parseArgs([])).toThrow("usage");
  expect(() => parseArgs(["a", "--bogus"])).toThrow("unknown option");
});
