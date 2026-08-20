-- Email channel: a per-shop inbound address, plus threads and messages.
-- Safe to re-run.
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "inbound_token" text;

CREATE TABLE IF NOT EXISTS "email_threads" (
  "id"              serial PRIMARY KEY,
  "shop_domain"     text NOT NULL,
  "customer_email"  text NOT NULL,
  "subject"         text NOT NULL,
  "status"          text NOT NULL DEFAULT 'open',
  "last_message_at" timestamp NOT NULL DEFAULT now(),
  "created_at"      timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "email_threads_shop_idx" ON "email_threads" ("shop_domain");

CREATE TABLE IF NOT EXISTS "email_messages" (
  "id"          serial PRIMARY KEY,
  "thread_id"   integer NOT NULL,
  "shop_domain" text NOT NULL,
  "direction"   text NOT NULL,
  "body"        text NOT NULL,
  "sent_at"     timestamp,
  "created_at"  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "email_messages_thread_idx" ON "email_messages" ("thread_id");
