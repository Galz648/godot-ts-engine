// Runs tsc over invalid.example.ts and checks we get exactly the expected number of errors (one per marked line).
import { spawnSync } from "node:child_process";
const EXPECTED = 8;
const out = spawnSync("npx", ["tsc", "--noEmit", "-p", "tsconfig.invalid.json"], { encoding: "utf8" }).stdout;
const errors = out.split("\n").filter((l) => l.includes("error TS"));
for (const e of errors) console.log(e);
console.log(`${errors.length} errors (expected ${EXPECTED})`);
process.exit(errors.length === EXPECTED ? 0 : 1);
