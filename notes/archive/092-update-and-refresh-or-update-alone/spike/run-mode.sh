#!/bin/bash
# Runs the whole test suite under one mode. Run it from the root of a worktree
# named merge-spike, since compare-runs.py strips paths up to that name.
# Usage: run-mode.sh <mode> <runs dir>, where mode is off, order, skip or update0.
mode=$1
out="$2/$mode"
echo "export const MERGE_MODE: string = '$mode';" > packages/libraries/utils/src/view-tick-api/merge-mode.ts
CI=true npx vitest run --testTimeout=180000 --reporter=default --reporter=json --outputFile.json="$out.json" > "$out.log" 2>&1
echo "exit $?" >> "$out.log"
grep -E "Test Files|Tests  |exit " "$out.log" | tail -4
