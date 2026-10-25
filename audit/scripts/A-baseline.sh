#!/usr/bin/env bash
# Session A baseline: tsc, lint, tests. Output to audit/scripts/A-out/.
cd "$(dirname "$0")/../.."
OUT=audit/scripts/A-out; mkdir -p "$OUT"
npx tsc --noEmit -p tsconfig.json > "$OUT/tsc.txt" 2>&1; echo "tsc exit $?" >> "$OUT/tsc.txt"
npx next lint > "$OUT/lint.txt" 2>&1; echo "lint exit $?" >> "$OUT/lint.txt"
npx vitest run --reporter=verbose > "$OUT/vitest.txt" 2>&1; echo "vitest exit $?" >> "$OUT/vitest.txt"
