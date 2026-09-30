import { expect, test } from "bun:test";
import { decideWrite, sha } from "./guard.ts";

const NEW = "new scene text\n";

test("no file yet: create", () => {
  expect(decideWrite({ existing: null, lastHash: undefined, next: NEW, force: false })).toBe("create");
});

test("file already equals the new text: unchanged (even if we never recorded it)", () => {
  expect(decideWrite({ existing: NEW, lastHash: undefined, next: NEW, force: false })).toBe("unchanged");
});

test("file is exactly what we wrote last time: safe to overwrite", () => {
  const old = "old scene text\n";
  expect(decideWrite({ existing: old, lastHash: sha(old), next: NEW, force: false })).toBe("overwrite");
});

test("file differs from what we wrote last time (edited in Godot?): blocked", () => {
  const written = "old scene text\n";
  expect(decideWrite({ existing: written + "[node name=\"Timer\"]\n", lastHash: sha(written), next: NEW, force: false })).toBe("blocked-edited");
});

test("file exists but we never wrote it (hand-made?): blocked", () => {
  expect(decideWrite({ existing: "hand made\n", lastHash: undefined, next: NEW, force: false })).toBe("blocked-unknown");
});

test("force overwrites in both blocked cases", () => {
  expect(decideWrite({ existing: "x", lastHash: sha("y"), next: NEW, force: true })).toBe("overwrite");
  expect(decideWrite({ existing: "x", lastHash: undefined, next: NEW, force: true })).toBe("overwrite");
});
