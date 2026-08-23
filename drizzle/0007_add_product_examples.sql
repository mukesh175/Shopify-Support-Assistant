-- Example products for the "find a product" prompt, cached per shop so the
-- storefront widget does not trigger an Admin API call on every page load.
-- Safe to re-run.
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "product_examples" text,
  ADD COLUMN IF NOT EXISTS "product_examples_at" timestamp;
