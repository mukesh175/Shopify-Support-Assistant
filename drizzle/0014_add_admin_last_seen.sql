-- Last time a merchant actually opened the app in their Shopify admin. Tells
-- an install that was never opened apart from one that was opened and ignored.
-- Additive, safe to re-run.
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "admin_last_seen_at" timestamp;
