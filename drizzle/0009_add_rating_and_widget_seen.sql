-- Shopper rating on an answer (👍/👎), and the last time the storefront widget
-- asked for its config — the only reliable signal that the theme embed is on.
-- Both additive and safe to re-run.
ALTER TABLE "query_logs"
  ADD COLUMN IF NOT EXISTS "rating" text;

ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "widget_last_seen_at" timestamp;
