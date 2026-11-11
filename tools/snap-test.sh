#!/bin/bash
# Copies the committed code (HEAD) into ../_snap and runs the browser tests there, so the working tree can keep changing meanwhile.
#   tools/snap-test.sh outDir [test names...]
ROOT=$(pwd); OUT=$(mkdir -p "$1" && cd "$1" && pwd); shift
git -C "$ROOT" worktree remove --force ../_snap 2>/dev/null; rm -rf "$ROOT/../_snap"
git -C "$ROOT" worktree add -q --detach "$ROOT/../_snap" HEAD && ln -s "$ROOT/node_modules" "$ROOT/../_snap/node_modules"
cd "$ROOT/../_snap" && NODE_PATH="$ROOT/tools/pw-lite-modules" tools/run-browser-tests.sh "$OUT" "$@"
