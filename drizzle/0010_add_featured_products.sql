-- Best-selling products with images, cached per shop for the widget's welcome
-- screen. Shares product_examples_at as its freshness stamp.
-- Additive and safe to re-run.
ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "featured_products" text;
