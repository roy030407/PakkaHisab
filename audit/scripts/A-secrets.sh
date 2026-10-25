#!/usr/bin/env bash
# Session A: scan all git history for secret-shaped strings.
# Prints ONLY commit, file and pattern class. Never prints the matched value.
cd "$(dirname "$0")/../.."
git log --all -p --no-color --format='@@COMMIT %h' | awk '
  /^@@COMMIT / { c=$2; next }
  /^diff --git / { f=$4; sub(/^b\//,"",f); next }
  /^\+/ && !/^\+\+\+/ {
    t=""
    if ($0 ~ /AIza[0-9A-Za-z_-]{35}/) t="google-api-key(AIza)"
    else if ($0 ~ /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/) t="jwt(eyJ..)"
    else if ($0 ~ /sk-ant-[A-Za-z0-9_-]{20,}/) t="anthropic-key(sk-ant-)"
    else if ($0 ~ /sk-[A-Za-z0-9]{20,}/) t="sk-style-key"
    else if ($0 ~ /phc_[A-Za-z0-9]{20,}/) t="posthog-project-key(public by design)"
    else if ($0 ~ /postgres(ql)?:\/\/[^:@ ]+:[^@ ]{6,}@/) t="postgres-url-with-password"
    else if ($0 ~ /UPSTASH_REDIS_REST_TOKEN *= *[A-Za-z0-9]{20,}/) t="upstash-token"
    else if ($0 ~ /CRON_SECRET *= *[^ <y]{12,}/) t="cron-secret"
    if (t!="") print c "\t" f "\t" t
  }' | sort -u
