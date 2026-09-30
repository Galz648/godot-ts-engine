// The overwrite guard. The emitter rewrites a whole scene file, so anything changed in the Godot editor would be lost.
// We remember the hash of what we last wrote; if the file on disk no longer matches it, someone else changed it.
import { createHash } from "node:crypto";

export const sha = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);

export type Decision = "create" | "unchanged" | "overwrite" | "blocked-edited" | "blocked-unknown";

export function decideWrite(a: { existing: string | null; lastHash: string | undefined; next: string; force: boolean }): Decision {
  if (a.existing === null) return "create";
  if (a.existing === a.next) return "unchanged";
  if (a.force) return "overwrite";
  if (a.lastHash === undefined) return "blocked-unknown"; // a file we never wrote: maybe hand-made
  return sha(a.existing) === a.lastHash ? "overwrite" : "blocked-edited";
}
