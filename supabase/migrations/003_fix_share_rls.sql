-- FILE: supabase/migrations/003_fix_share_rls.sql
-- WHAT THIS DOES: Removes the over-permissive public share RLS policy on
--   periodic_reports. The previous policy (share_token IS NOT NULL) allowed
--   any caller with the anon key to read ALL rows that have a share_token,
--   without knowing the token — a bulk enumeration vulnerability.
--
--   The /share/[token] page and /api/reports/share GET handler both use
--   the service-role client (bypasses RLS), so they do not need this policy.
--   Token-matching is enforced at the app layer (.eq('share_token', token)).
-- CHANGES: Fix for code review finding #1 (security)

DROP POLICY IF EXISTS "periodic_reports_public_share_read" ON periodic_reports;
