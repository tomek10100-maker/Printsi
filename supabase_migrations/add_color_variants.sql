-- Run this in Supabase SQL Editor to add color_variants support:
ALTER TABLE offers ADD COLUMN IF NOT EXISTS color_variants jsonb DEFAULT NULL;

-- Optional: index for faster queries on variants
CREATE INDEX IF NOT EXISTS idx_offers_color_variants ON offers USING gin(color_variants);
