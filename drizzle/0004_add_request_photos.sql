-- Photos a shopper attaches to a request, plus what the vision model made of
-- them. Photos live in their own table so listing requests never carries image
-- bytes, and so they can be purged or moved to object storage independently.
-- Safe to re-run.
ALTER TABLE "return_requests"
  ADD COLUMN IF NOT EXISTS "ai_assessment" text;

CREATE TABLE IF NOT EXISTS "request_photos" (
  "id"          serial PRIMARY KEY,
  "request_id"  integer NOT NULL,
  "shop_domain" text NOT NULL,
  "data_url"    text NOT NULL,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "photos_request_idx" ON "request_photos" ("request_id");
