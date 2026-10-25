#!/usr/bin/env bash
# FILE: audit/scripts/db-guard.sh
#
# WHAT THIS DOES:
#   Safety wrapper for every audit database command. Loads .env.audit.local,
#   prints the target host and tenant user, and refuses to run unless both
#   AUDIT_DATABASE_URL and AUDIT_SUPABASE_URL contain AUDIT_PROJECT_REF and
#   neither contains PROD_PROJECT_REF. The Supabase pooler hostname is shared
#   by many projects, so the project ref is checked in the full URL (it lives
#   in the username, postgres.<ref>), not in the hostname.
#   Then exports DIRECT_URL and DATABASE_URL = AUDIT_DATABASE_URL so Prisma
#   (prisma.config.ts reads DIRECT_URL; dotenv never overrides a preset var)
#   targets the audit DB without editing .env or .env.local.
#
# USAGE (from anywhere):
#   bash audit/scripts/db-guard.sh <command...>
#   bash audit/scripts/db-guard.sh npx prisma migrate status
#   bash audit/scripts/db-guard.sh bash -c 'psql "$AUDIT_DATABASE_URL" -f file.sql'
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env.audit.local; set +a
HOST=$(node -e 'const u=new URL(process.env.AUDIT_DATABASE_URL);console.log(u.hostname+":"+u.port+" user="+u.username)')
echo "[guard] db target: $HOST | api: $AUDIT_SUPABASE_URL"
for v in "$AUDIT_DATABASE_URL" "$AUDIT_SUPABASE_URL"; do
  case "$v" in *"$PROD_PROJECT_REF"*) echo "[guard] REFUSED: prod ref found"; exit 99;; esac
  case "$v" in *"$AUDIT_PROJECT_REF"*) ;; *) echo "[guard] REFUSED: audit ref missing"; exit 98;; esac
done
echo "[guard] OK: contains $AUDIT_PROJECT_REF, not $PROD_PROJECT_REF"
export DIRECT_URL="$AUDIT_DATABASE_URL" DATABASE_URL="$AUDIT_DATABASE_URL"
exec "$@"
