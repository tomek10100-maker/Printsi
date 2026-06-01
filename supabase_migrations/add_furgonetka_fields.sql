-- Add Furgonetka integration fields to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS furgonetka_package_id TEXT,
  ADD COLUMN IF NOT EXISTS label_url TEXT;
