# Cursor profile

    tools/cursor-profile/launch.sh          # open this game in a separate Cursor profile with live scene squiggles

A small, separate Cursor profile (`~/.cc-godot-ts`, override with `GODOT_TS_PROFILE_DIR`) with four TypeScript settings
and three extensions. It runs beside your normal Cursor and never touches it. Delete the folder to remove it.

Why it exists: TypeScript 7 (`useTsgo`) disables every TypeScript plugin, and the scene-lint plugin in
`engine/packages/lint-plugin` needs it off. The profile forces it off and points `typescript.tsserver.pluginPaths` at the
plugin. Pick **Use Workspace Version** (TypeScript 5.9.x) when Cursor asks.

The plugin must be built once (the game generator already did it): `npm run setup:editor`.
