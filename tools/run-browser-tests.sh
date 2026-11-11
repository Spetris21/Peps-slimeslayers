#!/bin/bash
# Runs the browser tests one after another (each into its own log, so a stray child process can never block the run).
#   tools/run-browser-tests.sh outDir [test names...]   (uses tools/pw-lite-modules for Playwright)
ROOT=$(pwd); export NODE_PATH="$ROOT/tools/pw-lite-modules${NODE_PATH:+:$NODE_PATH}"; OUT=${1:-browser-tests}; shift; mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
TESTS=${@:-"u7-saves ui-tour moveset-play lab-buttons audio-play browser-play phase5-play real-play"}
for t in $TESTS; do
  SRV=
  if [ "$t" = lab-buttons ]; then D=$(mktemp -d); PORT=3400 DATA_DIR=$D node server.js > /dev/null 2>&1 & SRV=$!; sleep 1.5; fi
  mkdir -p "$OUT/$t"
  if [ "$t" = real-play ]; then (cd "$OUT/$t" && node "$ROOT/tests/real-play.js") > "$OUT/$t.log" 2>&1; code=$?
  else node tests/$t.js "$OUT/$t" > "$OUT/$t.log" 2>&1; code=$?; fi
  # a PASS needs the test's own last word too (a browser that drops its connection can end node early with exit code 0)
  if [ $code = 0 ] && grep -qE 'all passed|buttons clicked, all fine|browser tests passed|REAL PLAY OK' "$OUT/$t.log"; then res=PASS; elif [ $code = 0 ]; then res='ENDED EARLY'; else res="EXIT $code"; fi
  printf '%-14s %-8s (%s ok, %s FAIL)\n' "$t" "$res" "$(grep -c '^  ok' "$OUT/$t.log")" "$(grep -c 'FAIL' "$OUT/$t.log")"
  if [ -n "$SRV" ]; then kill $SRV; fi
done
