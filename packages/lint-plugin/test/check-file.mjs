// Opens files in a real tsserver with the plugin and prints every diagnostic: a way to see what the editor would show.
// Usage: node test/check-file.mjs <folder with a tsconfig.json that lists the plugin> <file> [<file>...]
//        [--edit "<from>" "<to>"]   applies one text replacement as an UNSAVED edit to the first file before asking (repeatable)
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const edits = [];
for (let i = 0; i < args.length; i++) if (args[i] === "--edit") { edits.push([args[i + 1], args[i + 2]]); args.splice(i, 3); i--; }
const [dir, ...files] = args.map((a) => resolve(a));
if (!dir || files.length === 0) { console.error("usage: node test/check-file.mjs <dir> <file>... [--edit from to]"); process.exit(2); }

const child = spawn(process.execPath, [join(ROOT, "node_modules/typescript/lib/tsserver.js")], { stdio: ["pipe", "pipe", "ignore"] });
let buf = Buffer.alloc(0), seq = 0;
const waiting = new Map();
child.stdout.on("data", (c) => {
  buf = Buffer.concat([buf, c]);
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
const request = (command, a) => new Promise((res, rej) => {
  const id = ++seq;
  const t = setTimeout(() => rej(new Error(`timeout: ${command}`)), 30000);
  waiting.set(id, (m) => { clearTimeout(t); m.success ? res(m.body) : rej(new Error(`${command}: ${m.message}`)); });
  child.stdin.write(JSON.stringify({ seq: id, type: "request", command, arguments: a }) + "\n");
});

for (const file of files) {
  let text = readFileSync(file, "utf8");
  if (file === files[0]) for (const [from, to] of edits) { if (!text.includes(from)) throw new Error(`--edit: text not found: ${from}`); text = text.replace(from, to); }
  await request("open", { file, fileContent: text, projectRootPath: dir });
  const list = await request("semanticDiagnosticsSync", { file, includeLinePosition: true });
  const ours = list.filter((d) => d.source === "scene-lint");
  const others = list.filter((d) => d.source !== "scene-lint");
  console.log(`\n${file.replace(dir + "/", "")}: ${others.length} TypeScript diagnostic(s), ${ours.length} scene-lint`);
  for (const d of list) {
    const at = text.slice(d.start, d.start + d.length).replace(/\s+/g, " ").slice(0, 40);
    console.log(`   [${d.source ?? "ts"} ${d.code} ${d.category}] ${JSON.stringify(at)}  ${String(d.message).split("\n")[0].slice(0, 130)}`);
  }
}
child.kill();
