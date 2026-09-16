-- How the merchant wants the welcome-screen products chosen: automatically,
-- from one collection, or a specific list. JSON. Additive, safe to re-run.
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "featured_pick" text;
