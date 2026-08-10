-- Migration: add stripe_session_id to payouts for idempotency
-- Run this in Supabase SQL Editor

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Unique constraint: each Stripe session can only be credited once
CREATE UNIQUE INDEX IF NOT EXISTS payouts_stripe_session_id_unique
  ON payouts (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
