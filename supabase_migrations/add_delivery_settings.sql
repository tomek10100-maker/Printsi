-- Add delivery settings to profiles

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_shipping_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_shipping_threshold NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS disabled_couriers TEXT[] DEFAULT '{}';
