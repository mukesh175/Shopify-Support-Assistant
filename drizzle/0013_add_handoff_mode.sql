-- When the human-handoff options (support email, WhatsApp) are offered:
-- 'fallback' = only when the assistant cannot answer, 'always' = a button too.
-- Null reads as fallback. Additive, safe to re-run.
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "handoff_mode" text;
