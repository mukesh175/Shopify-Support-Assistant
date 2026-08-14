-- WhatsApp handoff number moved out of theme settings into the app database so
-- it is never rendered into the storefront HTML of shops whose plan does not
-- include handoff. Safe to re-run.
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "whatsapp_number" text;
