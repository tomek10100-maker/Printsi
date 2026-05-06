-- Migration: Add payout bank details columns to profiles
-- Run this in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payout_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_iban TEXT,
  ADD COLUMN IF NOT EXISTS payout_transfer_title TEXT;

-- Optional: add a comment for clarity
COMMENT ON COLUMN profiles.payout_recipient_name IS 'Legal name of the bank account holder for payout transfers';
COMMENT ON COLUMN profiles.payout_iban IS 'IBAN of the bank account for receiving payouts (stored uppercase, no spaces)';
COMMENT ON COLUMN profiles.payout_transfer_title IS 'Default transfer title used on payout bank transfers';
