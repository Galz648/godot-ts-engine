// Reads scenes, reports what the model could not hold, and writes each one back out. Run:
//   bun src/probe.ts <out-dir> <scene.tscn>...
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { emitTscn } from "../../emitter/tools/emit-tscn.ts";
import { parseTscn } from "./parse.ts";

const [outDir, ...files] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
for (const file of files) {
  const { root, unsupported, ignored } = parseTscn(readFileSync(file, "utf8"));
  const count = (n: typeof root): number => 1 + (n.children ?? []).reduce((a, c) => a + count(c), 0);
  console.log(`${basename(file)}: ${count(root)} nodes; unsupported: ${unsupported.length === 0 ? "none" : "\n   - " + unsupported.join("\n   - ")}; ignored: ${ignored.join(", ") || "none"}`);
  writeFileSync(join(resolve(outDir), `${basename(dirname(file))}-${basename(file)}`), emitTscn(root)); // folder in the name: two scenes can share a file name
}
