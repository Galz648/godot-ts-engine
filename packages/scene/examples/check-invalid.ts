// Runs tsc over the *.invalid.example.ts files and checks each file gives exactly the expected number of errors
// (one per marked line). A change in a count means a type got looser or stricter: look at it.
import { spawnSync } from "node:child_process";
const EXPECTED: Record<string, number> = { "invalid.example.ts": 8, "with-registry.invalid.example.ts": 3 };
const out = spawnSync("npx", ["tsc", "--noEmit", "-p", "tsconfig.invalid.json"], { encoding: "utf8" }).stdout;
const errors = out.split("\n").filter((l) => l.includes("error TS"));
for (const e of errors) console.log(e);
let ok = true;
for (const [file, expected] of Object.entries(EXPECTED)) {
  const got = errors.filter((e) => e.startsWith(`examples/${file}(`)).length;
  console.log(`${file}: ${got} errors (expected ${expected})`);
  if (got !== expected) ok = false;
}
process.exit(ok ? 0 : 1);
