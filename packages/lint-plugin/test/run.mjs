// Drives a real tsserver over its stdin/stdout protocol (what an editor does) and checks what the plugin
// reports. Edits go through `change` requests, so the files on disk are never modified: these are the
// "unsaved buffer" cases. Node built-ins only. Run: bun run build && node test/run.mjs

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LOGS = join(ROOT, "test/.logs");
const TSSERVER = join(ROOT, "node_modules/typescript/lib/tsserver.js");
rmSync(LOGS, { recursive: true, force: true });
mkdirSync(LOGS, { recursive: true });

// ---- a tiny tsserver client -------------------------------------------------------------------

function startServer(name, env = {}) {
  const logFile = join(LOGS, `${name}.log`);
  const child = spawn(process.execPath, [TSSERVER, "--logVerbosity", "verbose", "--logFile", logFile], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "ignore"],
  });
  let buf = Buffer.alloc(0);
  let seq = 0;
  const waiting = new Map();

  child.stdout.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const head = buf.indexOf("\r\n\r\n");
      if (head < 0) return;
      const len = Number(/Content-Length: (\d+)/.exec(buf.subarray(0, head).toString())[1]);
      if (buf.length < head + 4 + len) return;
      const msg = JSON.parse(buf.subarray(head + 4, head + 4 + len).toString());
      buf = buf.subarray(head + 4 + len);
      if (msg.type === "response") waiting.get(msg.request_seq)?.(msg);
    }
  });

  const request = (command, args) =>
    new Promise((resolvePromise, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${command}`)), 20000);
      waiting.set(id, (msg) => {
        clearTimeout(timer);
        msg.success ? resolvePromise(msg.body) : reject(new Error(`${command} failed: ${msg.message}`));
      });
      child.stdin.write(JSON.stringify({ seq: id, type: "request", command, arguments: args }) + "\n");
    });

  const texts = new Map(); // what the "editor buffer" currently holds, per file

  return {
    logFile,
    request,
    async open(file, projectRootPath) {
      texts.set(file, readFileSync(file, "utf8"));
      await request("open", { file, projectRootPath });
    },
    text: (file) => texts.get(file),
    /** Replace the whole buffer, sent as one minimal `change` edit, like typing or undo would. */
    async setText(file, next) {
      const prev = texts.get(file);
      let a = 0;
      while (a < prev.length && a < next.length && prev[a] === next[a]) a++;
      let b = 0;
      while (b < prev.length - a && b < next.length - a && prev[prev.length - 1 - b] === next[next.length - 1 - b]) b++;
      const pos = (text, offset) => {
        const before = text.slice(0, offset).split("\n");
        return { line: before.length, offset: before[before.length - 1].length + 1 };
      };
      const start = pos(prev, a);
      const end = pos(prev, prev.length - b);
      texts.set(file, next);
      await request("change", {
        file,
        line: start.line,
        offset: start.offset,
        endLine: end.line,
        endOffset: end.offset,
        insertString: next.slice(a, next.length - b),
      });
    },
    async diagnostics(file) {
      const list = await request("semanticDiagnosticsSync", { file, includeLinePosition: true });
      const text = texts.get(file);
      return list.map((d) => ({
        code: d.code,
        source: d.source,
        category: d.category,
        start: d.start,
        span: text.slice(d.start, d.start + d.length),
        message: String(d.message).split("\n")[0],
      }));
    },
    stop: () => child.kill(),
  };
}

// ---- reporting ---------------------------------------------------------------------------------

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "\n        " + detail : ""}`);
}
const show = (ds) => (ds.length ? ds.map((d) => `[${d.source ?? "ts"} ${d.code} ${d.category}] ${JSON.stringify(d.span)} "${d.message}"`).join("\n        ") : "(none)");
const lint = (ds) => ds.filter((d) => d.source === "scene-lint");

// ---- scenarios ---------------------------------------------------------------------------------

const SAMPLE = join(ROOT, "sample");
const DEF = join(SAMPLE, "level.def.ts");
const OTHER = join(SAMPLE, "other.ts");
const original = readFileSync(DEF, "utf8");

const a = startServer("plugin-on");
await a.open(DEF, SAMPLE);
await a.open(OTHER, SAMPLE);

let d = await a.diagnostics(DEF);
check("0. untouched sample file: no diagnostics", d.length === 0, show(d));

// 1. delete the CollisionShape2D from Ball, without saving
const shapeLine = '        { name: "Shape", type: "CollisionShape2D", props: { shape: { sub: { type: "CircleShape2D", props: { radius: 8 } } } } },\n';
await a.setText(DEF, original.replace(shapeLine, ""));
d = await a.diagnostics(DEF);
const ballAt = a.text(DEF).indexOf('name: "Ball"');
check(
  "1. delete CollisionShape2D -> one warning on `name: \"Ball\"` (file not saved)",
  lint(d).length === 1 && d.length === 1 && lint(d)[0].category === "warning" && lint(d)[0].code === 90001 && lint(d)[0].span === 'name: "Ball"' && lint(d)[0].start === ballAt && lint(d)[0].message.startsWith("This node has no shape"),
  show(d),
);

// 2. undo
await a.setText(DEF, original);
d = await a.diagnostics(DEF);
check("2. undo -> squiggle gone", d.length === 0, show(d));

// 3. duplicate sibling name: the second sibling should carry the error
const dup = original.replace('name: "Walls"', 'name: "Ball"');
await a.setText(DEF, dup);
d = await a.diagnostics(DEF);
check(
  "3. duplicate sibling name -> red squiggle on the SECOND one",
  lint(d).length === 1 && lint(d)[0].category === "error" && lint(d)[0].span === 'name: "Ball"' && lint(d)[0].start === dup.lastIndexOf('name: "Ball"') && lint(d)[0].start !== dup.indexOf('name: "Ball"'),
  show(d),
);

// 4. a normal TypeScript error in the same file still shows next to ours
const both = dup.replace("res://art/ball.png", "res://art/bal.png");
await a.setText(DEF, both);
d = await a.diagnostics(DEF);
check(
  "4. misspelled texture path (TS2322/2820) still shows alongside the scene-lint error",
  d.some((x) => (x.code === 2322 || x.code === 2820) && !x.source) && lint(d).length === 1,
  show(d),
);
await a.setText(DEF, original);

// 5. a child replaced by a function call: opaque, not a reason to give up
const call = original.replace('{ name: "Walls", type: "Node2D" }', "makeWall()");
await a.setText(DEF, call);
d = await a.diagnostics(DEF);
check(
  "5a. child replaced by a call -> scene-lint stays quiet (the call is opaque); TS still reports makeWall as undeclared",
  lint(d).length === 0 && d.some((x) => x.code === 2304),
  show(d),
);
await a.setText(DEF, call.replace(shapeLine, ""));
d = await a.diagnostics(DEF);
check("5b. ...and literal parts are still checked next to the call: deleting Ball's shape still warns", lint(d).length === 1 && lint(d)[0].span === 'name: "Ball"' && lint(d)[0].category === "warning", show(d));
const alive = await a.diagnostics(OTHER).then(() => true, () => false);
check("5c. server still answers requests afterwards", alive);
await a.setText(DEF, original.replace("export const scene = {", "export const scene = build() ?? {"));
d = await a.diagnostics(DEF);
check("5d. the scene root itself not a literal -> one 'not statically analyzable' warning", lint(d).length === 1 && lint(d)[0].code === 90002 && lint(d)[0].category === "warning", show(d));
await a.setText(DEF, original);
d = await a.diagnostics(DEF);
check("5e. restoring the file clears it", d.length === 0, show(d));

// 6. files that do not match *.def.ts
await a.setText(OTHER, 'export const answer: number = "not a number";\n');
d = await a.diagnostics(OTHER);
check("6. other.ts: only the normal TS error, nothing from scene-lint", d.length === 1 && d[0].code === 2322 && lint(d).length === 0, show(d));

// 9. a definition written with helpers, a loop and spreads (sample/helpers.def.ts)
const HELP = join(SAMPLE, "helpers.def.ts");
const helpOriginal = readFileSync(HELP, "utf8");
await a.open(HELP, SAMPLE);
d = await a.diagnostics(HELP);
check("9a. helper calls, a variable, a spread, a script constant: no false positives from scene-lint", lint(d).length === 0, show(d));

await a.setText(HELP, helpOriginal.replace('type: "Label"', 'type: "Labell"'));
d = await a.diagnostics(HELP);
check("9b. a class typo in a literal node is still an error on that node (and TS flags it too)", lint(d).length === 1 && lint(d)[0].category === "error" && lint(d)[0].span === 'name: "Label"' && d.some((x) => !x.source), show(d));

await a.setText(HELP, helpOriginal.replace('children: [shape(), { name: "Sprite"', 'children: [{ name: "Sprite"'));
d = await a.diagnostics(HELP);
check("9c. remove the only helper call from a body's children -> the missing-shape warning appears (analysis resumes once nothing is opaque)", lint(d).length === 1 && lint(d)[0].span === 'name: "Body"' && lint(d)[0].category === "warning", show(d));

await a.setText(HELP, helpOriginal.replace('{ name: "Label", type: "Label", props: { ...base, text: "hi" } },', '{ name: "Label", type: "Label", scriptProps: { speed: 1 } },'));
d = await a.diagnostics(HELP);
check("9d. script variables on a node with no script -> the new validator rule shows in the editor", lint(d).length === 1 && lint(d)[0].message.startsWith("These script variables are ignored"), show(d));

await a.setText(HELP, helpOriginal.replace('{ name: "Bricks", type: "Node2D", children: bricks },', '{ name: "Bricks", type: "Node2D", children: bricks },\n    { name: "Bricks", type: "Node2D" },'));
d = await a.diagnostics(HELP);
check("9e. two literal siblings with the same name are still caught next to opaque ones", lint(d).length === 1 && lint(d)[0].category === "error" && lint(d)[0].message.includes("Sibling names must be unique"), show(d));
await a.setText(HELP, helpOriginal);

check("files on disk were never modified (all edits were unsaved buffers)", readFileSync(DEF, "utf8") === original);

const logA = readFileSync(a.logFile, "utf8").split("\n");
const ours = logA.filter((l) => l.includes("scene-lint:"));
check("plugin loaded by tsserver (log has 'scene-lint: create')", ours.some((l) => l.includes("scene-lint: create")));
check("plugin never ran on other.ts (no 'linted ...other.ts' in log)", !ours.some((l) => l.includes("other.ts")));
console.log("\n  scene-lint lines in tsserver log (plugin-on), first 4 of " + ours.length + ":");
ours.slice(0, 4).forEach((l) => console.log("    " + l.replace(ROOT, "<poc4>")));

// Probes (not acceptance checks): where does the AST -> source mapping bend or break? Informational only.
console.log("\n  probes (informational):");
const probe = async (label, text) => {
  await a.setText(DEF, text);
  const pd = await a.diagnostics(DEF);
  console.log(`   - ${label}\n        ${show(pd)}`);
};
await probe("half-typed child (`{ name: \"X\", ty`)", original.replace('{ name: "Walls", type: "Node2D" }', '{ name: "X", ty'));
await probe("`as const` instead of `satisfies` (+ duplicate name)", dup.replace("} satisfies SceneNode;", "} as const;"));
await probe("quoted keys (+ duplicate name)", dup.replace(/name:/g, '"name":'));
await probe("name as template literal (+ duplicate name)", dup.replace('name: "Walls"', "name: `Ball`"));
await probe("spread inside children", original.replace('{ name: "Walls", type: "Node2D" }', "...[]"));
await probe("no `scene` variable", original.replace("export const scene", "export const level"));
await probe("duplicate name on the very first child of the root", original.replace('name: "Level"', 'name: "Ball"'));
await a.setText(DEF, original);

// 7. deliberate throw inside the plugin
const b = startServer("plugin-throws", { SCENE_LINT_DEBUG_THROW: "1" });
await b.open(DEF, SAMPLE);
await b.setText(DEF, original.replace("res://art/ball.png", "res://art/bal.png"));
d = await b.diagnostics(DEF);
check("7. plugin throws -> normal TS errors still reported (TS2322/2820), no scene-lint output", d.some((x) => x.code === 2322 || x.code === 2820) && lint(d).length === 0, show(d));
const errLines = readFileSync(b.logFile, "utf8").split("\n").filter((l) => l.includes("scene-lint: error") || l.includes("deliberate test failure"));
check("7b. the failure is written to the tsserver log", errLines.length > 0);
console.log("\n  log lines for the deliberate throw:");
errLines.slice(0, 3).forEach((l) => console.log("    " + l.replace(ROOT, "<poc4>")));
const aliveB = await b.diagnostics(OTHER).then(() => true, () => false);
check("7c. server still answers requests afterwards", aliveB);

// 8. timing on a non-def file: plugin on vs. an identical project without the plugin
async function timeOther(server, dir) {
  const file = join(dir, "other.ts");
  await server.open(file, dir);
  const n = 100;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) {
    await server.setText(file, `export const answer: number = ${i};\n`); // a real edit, so diagnostics are recomputed
    await server.diagnostics(file);
  }
  return Number(process.hrtime.bigint() - t0) / 1e6 / n;
}
const c = startServer("plugin-off");
const msOn = await timeOther(a, SAMPLE);
const msOff = await timeOther(c, join(ROOT, "sample-baseline"));
console.log(`\n  8. other.ts edit+diagnostics, 100 iterations: plugin on ${msOn.toFixed(2)} ms, plugin off ${msOff.toFixed(2)} ms per round trip`);

[a, b, c].forEach((s) => s.stop());
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
