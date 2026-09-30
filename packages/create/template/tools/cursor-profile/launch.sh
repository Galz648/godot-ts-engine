#!/usr/bin/env bash
# Opens Cursor in a SEPARATE, self-contained profile for this game: the TypeScript settings and
# extensions in this folder, isolated from your normal Cursor (so a global TypeScript 7 / tsgo setting
# can't stop the scene-lint plugin from loading).
#
# Usage:  tools/cursor-profile/launch.sh [folder-to-open] [--reset]
#   folder-to-open  defaults to the game's root folder
#   --reset         overwrite the profile's settings with the ones in this folder
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
TARGET="${1:-$REPO}"
[ -d "$TARGET" ] || { echo "no such folder: $TARGET" >&2; exit 1; }

# Keep this path SHORT: Cursor listens on a unix socket inside it and the path must be under ~100 chars.
PROFILE="${GODOT_TS_PROFILE_DIR:-$HOME/.cc-godot-ts}"
[ "${#PROFILE}" -le 60 ] || { echo "profile dir too long for Cursor's IPC socket: $PROFILE" >&2; exit 1; }

CURSOR="$(command -v cursor || true)"
[ -n "$CURSOR" ] || CURSOR="/Applications/Cursor.app/Contents/Resources/app/bin/cursor"
[ -x "$CURSOR" ] || { echo "cursor command not found (install it from Cursor: Shell Command: Install 'cursor' command)" >&2; exit 1; }
FLAGS=(--user-data-dir "$PROFILE/user" --extensions-dir "$PROFILE/ext")

mkdir -p "$PROFILE/user/User" "$PROFILE/ext"
if [ ! -f "$PROFILE/user/User/settings.json" ] || [ "${2:-}" = "--reset" ]; then
  cp "$HERE/settings.json" "$PROFILE/user/User/settings.json"
  echo "profile settings written to $PROFILE/user/User/settings.json"
fi

# Install the listed extensions once (again whenever extensions.txt changes). A failure is not fatal.
STAMP="$PROFILE/.extensions.$(shasum "$HERE/extensions.txt" | cut -c1-12)"
if [ ! -f "$STAMP" ]; then
  while read -r ext; do
    case "$ext" in ''|'#'*) continue ;; esac
    "$CURSOR" "${FLAGS[@]}" --install-extension "$ext" >/dev/null 2>&1 && echo "installed $ext" || echo "could not install $ext (skipped)"
  done < "$HERE/extensions.txt"
  touch "$STAMP"
fi

exec "$CURSOR" "${FLAGS[@]}" --new-window "$TARGET"
