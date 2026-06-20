-- Add soft-delete column for transaction voiding
ALTER TABLE "transactions" ADD COLUMN "voided_at" TIMESTAMPTZ DEFAULT NULL;
