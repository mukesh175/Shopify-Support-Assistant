-- Cancellation requests share the table with returns, so rows need to say
-- which they are. Existing rows are all returns, which the default covers.
-- Safe to re-run.
ALTER TABLE "return_requests"
  ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'return';
