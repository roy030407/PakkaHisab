#!/usr/bin/env bash
# Session A: vitest coverage over all of lib/ (including files with no tests).
# Requires: npm install --no-save @vitest/coverage-v8@<vitest version>
cd "$(dirname "$0")/../.."
OUT=audit/scripts/A-out; mkdir -p "$OUT"
npx vitest run --coverage.enabled --coverage.provider=v8 \
  --coverage.include='lib/**/*.ts' --coverage.exclude='lib/**/*.test.ts' --coverage.exclude='lib/generated/**' \
  --coverage.reporter=text --coverage.reporter=json-summary \
  --coverage.reportsDirectory="$OUT/coverage" > "$OUT/coverage.txt" 2>&1
echo "exit $?" >> "$OUT/coverage.txt"
node audit/scripts/A-coverage-summary.cjs > "$OUT/coverage-summary.txt"
