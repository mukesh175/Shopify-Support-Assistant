-- Support email shown to shoppers who ask for a human. Additive, safe to re-run.
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "support_email" text;
