-- Which chat buttons the storefront widget offers, as a JSON object keyed by
-- action id. Null = the merchant has not changed anything, so show them all.
-- Safe to re-run.
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "quick_actions" text;
