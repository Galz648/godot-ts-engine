#!/usr/bin/env bash
# Runs every check of every package. Exit code 0 only if all of them pass.
# Needs bun and Node 24 on PATH, and `bun install` done once in each package.
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
fail=0
run() {
  local pkg="$1"; shift
  if (cd "$ROOT/packages/$pkg" && "$@" >/dev/null 2>&1); then echo "ok    $pkg: $*"; else echo "FAIL  $pkg: $*"; fail=1; fi
}
run scene       bun run check
run scene       bun run check:examples
run registry    bun run check
run registry    bun run gen
run emitter     bun test tools/emit-tscn.test.ts
run emitter     bun run check
run validator   npm test
run validator   npm run check
run build       bun run test
run build       bun run check
run lint-plugin bun run check
run lint-plugin bun run test
[ "$fail" = 0 ] && echo "all checks passed" || echo "SOME CHECKS FAILED"
exit $fail
