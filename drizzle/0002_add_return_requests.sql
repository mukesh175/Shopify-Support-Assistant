-- Return requests raised by shoppers through the assistant. Creating a new
-- table does not affect existing queries, so this can be applied before or
-- after the deploy; the Returns page simply has nothing to read until it runs.
-- Safe to re-run.
CREATE TABLE IF NOT EXISTS "return_requests" (
  "id"          serial PRIMARY KEY,
  "shop_domain" text NOT NULL,
  "order_name"  text NOT NULL,
  "email"       text NOT NULL,
  "items"       text NOT NULL,
  "reason"      text NOT NULL,
  "note"        text,
  "status"      text NOT NULL DEFAULT 'pending',
  "created_at"  timestamp NOT NULL DEFAULT now(),
  "updated_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "returns_shop_idx" ON "return_requests" ("shop_domain");
