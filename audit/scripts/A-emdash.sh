#!/usr/bin/env bash
# Session A: count em dashes (U+2014, bytes E2 80 94) in source dirs and the last 50 commit messages.
cd "$(dirname "$0")/../.."
ED=$'\xe2\x80\x94'
echo "== source files with em dashes (count per file)"
LC_ALL=C grep -rnF "$ED" app components lib hooks types data middleware.ts supabase/migrations prisma/schema.prisma README.md 2>/dev/null \
  | grep -v "lib/generated/" | awk -F: '{print $1}' | sort | uniq -c | sort -rn
echo "== last 50 commits with an em dash in subject or body"
for h in $(git log -50 --format=%h); do git log -1 --format='%s%n%b' $h | LC_ALL=C grep -qF "$ED" && echo "$h $(git log -1 --format=%s $h)"; done
