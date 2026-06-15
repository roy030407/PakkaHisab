-- FILE: supabase/migrations/006_reminder_template.sql
-- WHAT THIS DOES: Adds stores.reminder_template, the editable WhatsApp reminder
--   message used by Slice A (Collections). NULL means "use the seeded default"
--   (DEFAULT_REMINDER_TEMPLATE in lib/collections/reminder.ts). Placeholders the
--   UI fills: {name}, {amount}, {shop}.
--
-- CHANGES THIS SESSION:
--   - New column: stores.reminder_template TEXT NULL
--
-- HOW TO APPLY:
--   Paste this file into the Supabase SQL editor and run.
--   Safe to re-run (IF NOT EXISTS).

ALTER TABLE stores ADD COLUMN IF NOT EXISTS reminder_template TEXT;

-- Verify:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'stores' AND column_name = 'reminder_template';
