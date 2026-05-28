-- Add cancellation fields to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_initiated_by TEXT;

-- Add shipping_cost to orders so we can deduct it on cancellation refunds
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_cost_eur NUMERIC(10,2) DEFAULT 0;
