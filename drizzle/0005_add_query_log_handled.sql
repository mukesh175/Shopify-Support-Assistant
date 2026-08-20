-- Marks a customer question the merchant has already acted on, so the gaps
-- worth attention are the ones still outstanding. Distinct from `resolved`,
-- which records whether the assistant answered at the time. Safe to re-run.
ALTER TABLE "query_logs"
  ADD COLUMN IF NOT EXISTS "handled" boolean NOT NULL DEFAULT false;
